import { fireEvent, render, screen } from '@testing-library/react';

import { WeeklySummaryCard } from './WeeklySummaryCard';

const summary = {
  summary: 'You spent 142.50 EUR across 8 expenses, up 23% from last week.',
  weekStart: '2026-06-29',
  generatedAt: '2026-07-03T18:00:00Z',
};

const noop = () => undefined;

describe('WeeklySummaryCard', () => {
  it('shows the summary text with its week', () => {
    render(
      <WeeklySummaryCard
        summary={summary}
        loading={false}
        error={false}
        generating={false}
        onGenerate={noop}
      />
    );
    expect(screen.getByText(summary.summary)).toBeTruthy();
    expect(screen.getByText(/Week of/)).toBeTruthy();
    expect(screen.getByLabelText('Regenerate summary')).toBeTruthy();
  });

  it('shows the empty state with a generate button before the first summary', () => {
    const onGenerate = vi.fn();
    render(
      <WeeklySummaryCard
        summary={null}
        loading={false}
        error={false}
        generating={false}
        onGenerate={onGenerate}
      />
    );
    expect(screen.getByText('No summary yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Generate now/ }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('regenerates from the header button when a summary exists', () => {
    const onGenerate = vi.fn();
    render(
      <WeeklySummaryCard
        summary={summary}
        loading={false}
        error={false}
        generating={false}
        onGenerate={onGenerate}
      />
    );
    fireEvent.click(screen.getByLabelText('Regenerate summary'));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('shows neither summary nor empty state while loading', () => {
    render(
      <WeeklySummaryCard
        summary={null}
        loading={true}
        error={false}
        generating={false}
        onGenerate={noop}
      />
    );
    expect(screen.queryByText('No summary yet')).toBeNull();
  });

  it('shows an error message when loading failed', () => {
    render(
      <WeeklySummaryCard
        summary={null}
        loading={false}
        error={true}
        generating={false}
        onGenerate={noop}
      />
    );
    expect(screen.getByText('Could not load the weekly summary.')).toBeTruthy();
  });
});
