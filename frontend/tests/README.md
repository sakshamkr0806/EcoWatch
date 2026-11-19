# Frontend tests

Placeholder for the component and integration tests.

Suggested setup (when you are ready):

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Then add to `package.json`:

```json
"scripts": { "test": "vitest" }
```

A good first smoke test (`tests/components/Card.test.jsx`):

```jsx
import { render, screen } from '@testing-library/react';
import Card from '../../src/components/common/Card';

test('renders a card title', () => {
  render(<Card title="Air Quality">content</Card>);
  expect(screen.getByText('Air Quality')).toBeInTheDocument();
});
```

Recommended coverage targets:
- `utils/aqi.js` / `utils/wqi.js` — index maths (pure functions, easiest wins)
- `components/common/Gauge` — renders value/label
- `pages/Login` — rejects bad credentials, submits good ones
