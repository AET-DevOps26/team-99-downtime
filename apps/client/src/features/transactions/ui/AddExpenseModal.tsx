import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { createTransaction } from '../api/transactionApi';
import { CategoryPicker } from './CategoryPicker';

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function AddExpenseModal({ open, onOpenChange, onCreated }: AddExpenseModalProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCategoryId('');
    setAmount('');
    setDescription('');
    setDate(today);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const save = async () => {
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
      await createTransaction({
        categoryId,
        amount: parsedAmount,
        currency: 'EUR',
        description,
        date,
      });
      toast.success('Expense added');
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('Could not add expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Category</Label>
            <CategoryPicker id="expense-category" value={categoryId} onChange={setCategoryId} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Amount (€)</Label>
            <Input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you spend on?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            Add expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddExpenseModal;
