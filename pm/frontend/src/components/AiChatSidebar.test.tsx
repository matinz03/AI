import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiChatSidebar } from '@/components/AiChatSidebar';

describe('AiChatSidebar', () => {
  it('shows a conversation and reports a board update', async () => {
    const onSend = vi.fn().mockResolvedValue({
      assistant: 'I moved the card.',
      boardUpdated: true,
    });
    render(<AiChatSidebar onSend={onSend} />);

    await userEvent.type(screen.getByLabelText('Ask the project assistant'), 'Move card-1');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('I moved the card.')).toBeInTheDocument();
    expect(screen.getByText('Board updated from the assistant response.')).toBeInTheDocument();
    expect(onSend).toHaveBeenCalledWith('Move card-1', []);
  });

  it('keeps the form recoverable after an error', async () => {
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error('AI service is unavailable.'))
      .mockResolvedValueOnce({ assistant: 'Recovered.', boardUpdated: false });
    render(<AiChatSidebar onSend={onSend} />);

    const input = screen.getByLabelText('Ask the project assistant');
    await userEvent.type(input, 'What changed?');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI service is unavailable.');
    expect(input).toHaveValue('What changed?');

    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Recovered.')).toBeInTheDocument();
  });
});
