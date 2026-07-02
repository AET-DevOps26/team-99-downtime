import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { updateTransaction, type Transaction } from '../api/transactionApi';
import { CategoryPicker } from './CategoryPicker';

interface EditExpenseModalProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditExpenseModal({
  transaction,
  open,
  onOpenChange,
  onSaved,
}: EditExpenseModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setCategoryId(transaction.categoryId);
      setAmount(String(transaction.amount));
      setDescription(transaction.description);
      setDate(transaction.date);
    }
  }, [transaction]);

  const save = async () => {
    if (!transaction) return;
    if (!categoryId || !amount || !description || !date) {
      toast.error('Fill in all fields');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    setSaving(true);
    try {
      await updateTransaction(transaction.id, {
        categoryId,
        amount: parsedAmount,
        currency: transaction.currency,
        description,
        date,
      });
      toast.success('Expense updated');
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error('Could not update expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-category">Category</Label>
            <CategoryPicker
              id="edit-expense-category"
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-amount">Amount (€)</Label>
            <Input
              id="edit-expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-description">Description</Label>
            <Input
              id="edit-expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-expense-date">Date</Label>
            <Input
              id="edit-expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditExpenseModal;
