import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2Icon, SparklesIcon, UploadIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import { ApiError } from '@/shared/lib/api';
import { createTransaction, createTransactionsFromText } from '../api/transactionApi';
import { CategoryPicker } from './CategoryPicker';

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const TOO_VAGUE_MESSAGE =
  'That’s too vague — say what you bought and how much it cost, e.g. "Lunch at Mensa 8.50".';
const NO_CATEGORIES_MESSAGE =
  'Create a category first — the AI files each expense into one of your categories.';

export function AddExpenseModal({ open, onOpenChange, onCreated }: AddExpenseModalProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [tab, setTab] = useState<'manual' | 'text'>('manual');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [freeText, setFreeText] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCategoryId('');
    setAmount('');
    setDescription('');
    setDate(today);
    setFreeText('');
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const finish = (message: string) => {
    toast.success(message);
    reset();
    onOpenChange(false);
    onCreated?.();
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
      finish('Expense added');
    } catch {
      toast.error('Could not add expense');
    } finally {
      setSaving(false);
    }
  };

  const saveFreeText = async () => {
    const text = freeText.trim();
    if (!text) {
      toast.error('Describe your expense first, or upload a .txt file');
      return;
    }
    setSaving(true);
    try {
      const created = await createTransactionsFromText(text);
      finish(created.length === 1 ? 'Expense added' : `${created.length} expenses added`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const code = (err.body as { error?: string } | undefined)?.error;
        toast.error(code === 'no_categories' ? NO_CATEGORIES_MESSAGE : TOO_VAGUE_MESSAGE);
      } else {
        toast.error('Could not add expense');
      }
    } finally {
      setSaving(false);
    }
  };

  const loadTxtFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(
      (content) =>
        setFreeText((prev) => (prev.trim() ? `${prev.trim()}\n${content.trim()}` : content.trim())),
      () => toast.error('Could not read that file')
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'text')}>
          <TabsList className="w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="text">
              <SparklesIcon /> Free text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-2">
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
          </TabsContent>

          <TabsContent value="text" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-text">Describe your expenses</Label>
              <Textarea
                id="expense-text"
                rows={4}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder='e.g. "yesterday 12.30 groceries at Rewe and 3.50 coffee"'
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                The AI fills in amount, merchant, category and date — several expenses in one
                sentence become several transactions.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon /> Upload .txt
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  loadTxtFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void (tab === 'text' ? saveFreeText() : save())} disabled={saving}>
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            Add expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddExpenseModal;
