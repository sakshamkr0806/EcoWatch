const express = require('express');
const prisma = require('../config');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const STATION_TYPES = new Set(['AIR', 'WATER', 'BOTH']);
const STATION_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'MAINTENANCE']);
const MAX_PAGE_SIZE = 100;

router.use(authMiddleware);

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : null;
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseStatus(body) {
  if (body.status !== undefined) {
    return STATION_STATUSES.has(body.status) ? body.status : null;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return null;
    return body.isActive ? 'ACTIVE' : 'INACTIVE';
  }
  return 'ACTIVE';
}

function responseStation(station) {
  return {
    id: station.id,
    name: station.name,
    code: station.stationcode,
    type: station.stationtype,
    status: station.status,
    lat: Number(station.latitude),
    lng: Number(station.longitude),
    area: station.locality ?? station.districts?.name ?? null,
    description: null,
    districtId: station.districtid,
    address: station.address,
    installedAt: station.installedat,
    createdAt: station.createdat,
    updatedAt: station.updatedat,
    ...(station._count ? { measurementCount: station._count.measurements } : {}),
  };
}

function parseCoordinates(body) {
  const latitudeValue = body.lat ?? body.latitude;
  const longitudeValue = body.lng ?? body.longitude;
  if (latitudeValue === undefined || latitudeValue === null || String(latitudeValue).trim() === '') return null;
  if (longitudeValue === undefined || longitudeValue === null || String(longitudeValue).trim() === '') return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseStationType(body) {
  const type = body.stationType ?? body.stationtype ?? body.type;
  return STATION_TYPES.has(type) ? type : null;
}

async function validateDistrict(districtId) {
  if (typeof districtId !== 'string' || !districtId.trim()) return false;
  return Boolean(await prisma.district.findUnique({ where: { id: districtId.trim() } }));
}

async function uniqueStationCode(rawCode, name) {
  const supplied = typeof rawCode === 'string' && rawCode.trim();
  const base = supplied
    ? rawCode.trim()
    : name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32) || 'STATION';
  if (supplied) {
    return await prisma.monitoringstation.findUnique({ where: { stationcode: base } })
      ? null
      : base;
  }

  for (let suffix = 1; suffix < 10000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await prisma.monitoringstation.findUnique({
      where: { stationcode: candidate },
    });
    if (!existing) return candidate;
  }
  return null;
}

function operatorStationFilter(userId) {
  return { stationassignments: { some: { userid: userId, endedat: null } } };
}

function isAdmin(req) {
  return req.user?.roles?.includes('ADMIN');
}

function canAccessStation(station, req) {
  return isAdmin(req) || station.stationassignments?.some(
    (assignment) => assignment.userid === req.user.id && assignment.endedat === null
  );
}

function handlePrismaError(error, res, action) {
  if (error?.code === 'P2002') {
    return res.status(409).json({ error: 'Station code already exists' });
  }
  if (error?.code === 'P2003') {
    return res.status(409).json({ error: `Station has related records and cannot be ${action === 'delete' ? 'deleted' : 'changed'}` });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ error: 'Station not found' });
  }
  console.error(`Station ${action} failed:`, error?.message);
  return res.status(500).json({ error: `Unable to ${action} station` });
}

router.get('/', async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = parsePositiveInteger(req.query.limit, 20, MAX_PAGE_SIZE);
  if (!page || !limit || (page - 1) * limit > 2147483647) {
    return res.status(400).json({ error: `page and limit must be positive integers; limit cannot exceed ${MAX_PAGE_SIZE}` });
  }

  const type = req.query.type ?? req.query.stationType;
  if (type !== undefined && !STATION_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid station type' });
  }

  let status = req.query.status;
  if (req.query.isActive !== undefined) {
    if (!['true', 'false'].includes(req.query.isActive)) {
      return res.status(400).json({ error: 'isActive must be true or false' });
    }
    const activeStatus = req.query.isActive === 'true' ? 'ACTIVE' : 'INACTIVE';
    if (status !== undefined && status !== activeStatus) {
      return res.status(400).json({ error: 'Conflicting status filters' });
    }
    status = activeStatus;
  }
  if (status !== undefined && !STATION_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid station status' });
  }

  const where = {
    ...(type ? { stationtype: type } : {}),
    ...(status ? { status } : {}),
    ...(!isAdmin(req) ? operatorStationFilter(req.user.id) : {}),
  };

  try {
    const stations = await prisma.monitoringstation.findMany({
      where,
      include: {
        districts: { select: { id: true, name: true } },
        stationassignments: !isAdmin(req)
          ? { where: { userid: req.user.id, endedat: null }, select: { userid: true, endedat: true } }
          : false,
        _count: { select: { measurements: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return res.json(stations.map(responseStation));
  } catch (error) {
    return handlePrismaError(error, res, 'list');
  }
});

router.post('/', authMiddleware.requireRole('ADMIN'), async (req, res) => {
  try {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const districtId = body.districtId ?? body.districtid;
  const stationtype = parseStationType(body);
  const coordinates = parseCoordinates(body);
  const status = parseStatus(body);

  if (!name || !stationtype || !coordinates || !status) {
    return res.status(400).json({ error: 'Valid name, station type, status, latitude, and longitude are required' });
  }
  if (!(await validateDistrict(districtId))) {
    return res.status(400).json({ error: 'A valid districtId is required' });
  }
  if (body.userId !== undefined && (typeof body.userId !== 'string' || !body.userId.trim())) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  const rawStationCode = body.stationcode ?? body.code;
  if (rawStationCode !== undefined && typeof rawStationCode !== 'string') {
    return res.status(400).json({ error: 'Invalid station code' });
  }
  const installedat = body.installedAt ? new Date(body.installedAt) : null;
  if (installedat && Number.isNaN(installedat.getTime())) {
    return res.status(400).json({ error: 'Invalid installedAt date' });
  }

    const stationcode = await uniqueStationCode(rawStationCode, name);
    if (!stationcode) {
      return res.status(409).json({ error: 'Station code already exists' });
    }

    let assignedUser = null;
    if (body.userId) {
      assignedUser = await prisma.user.findUnique({ where: { id: body.userId.trim() } });
      if (!assignedUser) return res.status(400).json({ error: 'Invalid userId' });
    }

    const station = await prisma.$transaction(async (transaction) => {
      const created = await transaction.monitoringstation.create({
        data: {
          name,
          stationcode,
          stationtype,
          status,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          districtid: districtId.trim(),
          locality: body.locality ?? body.area ?? null,
          address: body.address ?? null,
          installedat,
          updatedat: new Date(),
        },
        include: { districts: { select: { id: true, name: true } }, _count: { select: { measurements: true } } },
      });
      if (assignedUser) {
        await transaction.stationAssignment.create({
          data: { userid: assignedUser.id, stationid: created.id, assignedbyuserid: req.user.id },
        });
      }
      return created;
    });
    return res.status(201).json(responseStation(station));
  } catch (error) {
    return handlePrismaError(error, res, 'create');
  }
});

router.get('/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid station ID' });

  try {
    const station = await prisma.monitoringstation.findUnique({
      where: { id: req.params.id },
      include: {
        districts: { select: { id: true, name: true } },
        stationassignments: !isAdmin(req)
          ? { where: { userid: req.user.id, endedat: null }, select: { userid: true, endedat: true } }
          : true,
        _count: { select: { measurements: true } },
      },
    });
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (!canAccessStation(station, req)) {
      return res.status(403).json({ error: 'Station is not assigned to this user' });
    }
    return res.json(responseStation(station));
  } catch (error) {
    return handlePrismaError(error, res, 'read');
  }
});

router.patch('/:id', authMiddleware.requireRole('ADMIN'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid station ID' });
  try {
  const body = req.body || {};
  const data = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return res.status(400).json({ error: 'Invalid station name' });
    data.name = body.name.trim();
  }
  const stationtype = parseStationType(body);
  if (body.stationType !== undefined || body.stationtype !== undefined || body.type !== undefined) {
    if (!stationtype) return res.status(400).json({ error: 'Invalid station type' });
    data.stationtype = stationtype;
  }
  if (body.stationcode !== undefined || body.code !== undefined) {
    const code = body.stationcode ?? body.code;
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'Invalid station code' });
    const existing = await prisma.monitoringstation.findUnique({ where: { stationcode: code.trim() } });
    if (existing && existing.id !== req.params.id) return res.status(409).json({ error: 'Station code already exists' });
    data.stationcode = code.trim();
  }
  if (body.status !== undefined || body.isActive !== undefined) {
    const status = parseStatus(body);
    if (!status) return res.status(400).json({ error: 'Invalid station status' });
    data.status = status;
  }
  if (body.lat !== undefined || body.latitude !== undefined) {
    const value = body.lat ?? body.latitude;
    const latitude = value === null || String(value).trim() === '' ? NaN : Number(value);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Invalid latitude' });
    }
    data.latitude = latitude;
  }
  if (body.lng !== undefined || body.longitude !== undefined) {
    const value = body.lng ?? body.longitude;
    const longitude = value === null || String(value).trim() === '' ? NaN : Number(value);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Invalid longitude' });
    }
    data.longitude = longitude;
  }
  if (body.districtId !== undefined || body.districtid !== undefined) {
    const districtId = body.districtId ?? body.districtid;
    if (!(await validateDistrict(districtId))) return res.status(400).json({ error: 'Invalid districtId' });
    data.districtid = districtId.trim();
  }
  if (body.locality !== undefined || body.area !== undefined) data.locality = body.locality ?? body.area;
  if (body.address !== undefined) data.address = body.address;
  if (body.installedAt !== undefined) {
    const installedat = new Date(body.installedAt);
    if (Number.isNaN(installedat.getTime())) return res.status(400).json({ error: 'Invalid installedAt date' });
    data.installedat = installedat;
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid station fields provided' });
  data.updatedat = new Date();

    const station = await prisma.monitoringstation.update({
      where: { id: req.params.id },
      data,
      include: { districts: { select: { id: true, name: true } }, _count: { select: { measurements: true } } },
    });
    return res.json(responseStation(station));
  } catch (error) {
    return handlePrismaError(error, res, 'update');
  }
});

router.delete('/:id', authMiddleware.requireRole('ADMIN'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid station ID' });
  try {
    await prisma.monitoringstation.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Station deleted successfully' });
  } catch (error) {
    return handlePrismaError(error, res, 'delete');
  }
});

module.exports = router;
