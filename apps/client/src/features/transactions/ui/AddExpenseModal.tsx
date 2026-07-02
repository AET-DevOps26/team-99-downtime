import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheetIcon, Loader2Icon, SparklesIcon, UploadIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import { ApiError } from '@/shared/lib/api';
import {
  createTransaction,
  createTransactionsFromText,
  importTransactionsCsv,
  type ImportResult,
} from '../api/transactionApi';
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
const INVALID_CSV_MESSAGE =
  'That file could not be read as a CSV of transactions — export a CSV from your bank and try again.';

/** The backend's 422 error code (`too_vague`, `no_categories`, `invalid_csv`), if any. */
const error422Code = (err: unknown) =>
  err instanceof ApiError && err.status === 422
    ? (err.body as { error?: string } | undefined)?.error
    : undefined;

export function AddExpenseModal({ open, onOpenChange, onCreated }: AddExpenseModalProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [tab, setTab] = useState<'manual' | 'text' | 'csv'>('manual');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [freeText, setFreeText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCategoryId('');
    setAmount('');
    setDescription('');
    setDate(today);
    setFreeText('');
    setCsvFile(null);
    setCsvResult(null);
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
      const code = error422Code(err);
      if (code) {
        toast.error(code === 'no_categories' ? NO_CATEGORIES_MESSAGE : TOO_VAGUE_MESSAGE);
      } else {
        toast.error('Could not add expense');
      }
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async () => {
    if (!csvFile) {
      toast.error('Choose a CSV file first');
      return;
    }
    setSaving(true);
    try {
      const result = await importTransactionsCsv(csvFile);
      setCsvResult(result);
      if (result.imported.length > 0) onCreated?.();
    } catch (err) {
      const code = error422Code(err);
      if (code) {
        toast.error(code === 'no_categories' ? NO_CATEGORIES_MESSAGE : INVALID_CSV_MESSAGE);
      } else {
        toast.error('Import failed — please try again');
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'text' | 'csv')}>
          <TabsList className="w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="text">
              <SparklesIcon /> Free text
            </TabsTrigger>
            <TabsTrigger value="csv">
              <FileSpreadsheetIcon /> Bank CSV
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
          <TabsContent value="csv" className="space-y-3 pt-2">
            {csvResult ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {csvResult.imported.length} imported, {csvResult.skipped.length} skipped
                </p>
                {csvResult.skipped.length > 0 && (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {csvResult.skipped.map((s) => (
                      <li key={s.row}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCsvResult(null);
                    setCsvFile(null);
                  }}
                >
                  Import another file
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => csvInputRef.current?.click()}
                >
                  <UploadIcon /> {csvFile ? csvFile.name : 'Choose a bank CSV export'}
                </Button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Any bank format works — the AI reads each row and fills in amount, merchant,
                  category and date. Credits and unreadable rows are skipped and listed afterwards.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {tab === 'csv' && csvResult ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  void (tab === 'csv' ? importCsv() : tab === 'text' ? saveFreeText() : save())
                }
                disabled={saving}
              >
                {saving && <Loader2Icon className="size-4 animate-spin" />}
                {tab === 'csv' ? (saving ? 'Importing…' : 'Import') : 'Add expense'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddExpenseModal;
