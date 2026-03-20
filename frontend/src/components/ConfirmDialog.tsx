interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    // role="dialog" allows Playwright to find this with page.getByRole('dialog')
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm action"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
    >
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 400, width: '100%' }}>
        <p style={{ marginBottom: 16 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            data-testid="cancel-delete"
            onClick={onCancel}
            style={{ padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button
            data-testid="confirm-delete"
            onClick={onConfirm}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
