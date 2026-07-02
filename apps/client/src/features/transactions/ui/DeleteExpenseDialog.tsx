import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { type Transaction } from '../api/transactionApi';

interface DeleteExpenseDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user confirms. The caller performs the (optimistic) delete. */
  onConfirm: () => void;
}

export function DeleteExpenseDialog({
  transaction,
  open,
  onOpenChange,
  onConfirm,
}: DeleteExpenseDialogProps) {
  const confirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete expense</DialogTitle>
          <DialogDescription>
            {transaction
              ? `Delete "${transaction.description}"? This cannot be undone.`
              : 'This cannot be undone.'}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteExpenseDialog;
