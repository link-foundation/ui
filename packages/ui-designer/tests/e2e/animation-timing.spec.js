import { test, expect } from '@playwright/test';

test('player and sampler agree on literal keys and segment easing', async ({
  page,
}) => {
  await page.goto('/packages/ui-designer/examples/timeline.html');
  const samples = await page.evaluate(async () => {
    const { createPlayer, loadAnimations, sample } =
      await import('/packages/ui-animation/src/index.js');
    const text = `a: animation
  target ok
  duration 1000ms
  delay 100ms
  easing ease-in
  iterations 2
  direction alternate
  fill both
  persist true
  track opacity
    key 0 0 linear
    key 0.3 1 hold
    key 1 0
  track scale
    key 0 1
    key 0.3 0.96
    key 1 1
`;
    const node = document.querySelector('.designer-canvas [data-link-id=ok]');
    const player = createPlayer(
      { nodeFor: () => node },
      {
        animations: text,
        motion: 'full',
      }
    );
    const animation = loadAnimations(text).animations.get('a');
    const control = player.play('a');
    control.pause();
    try {
      return [0, 100, 250, 400, 750, 1100, 1450, 1800, 1950, 2100].map(
        (time) => {
          control.seek(time);
          const style = window.getComputedStyle(node);
          return {
            time,
            expected: sample(animation, time),
            actual: {
              opacity: Number(style.opacity),
              scale: Number(style.scale),
            },
          };
        }
      );
    } finally {
      control.cancel();
    }
  });
  for (const { time, expected, actual } of samples) {
    expect(actual.opacity, `opacity at ${time}ms`).toBeCloseTo(
      expected.opacity,
      4
    );
    expect(actual.scale, `scale at ${time}ms`).toBeCloseTo(expected.scale, 4);
  }
});
