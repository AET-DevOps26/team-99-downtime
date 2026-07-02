import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileUpIcon, Loader2Icon, SparklesIcon, UploadIcon } from 'lucide-react';

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
  importTransactionsFile,
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
const INVALID_FILE_MESSAGE =
  'That file could not be read — upload a bank CSV export or a text file with one expense per line.';
const NO_EXPENSES_MESSAGE = 'No expenses could be recognized in that file.';

/** The backend's 422 error code (`too_vague`, `no_categories`, `invalid_file`, …), if any. */
const error422Code = (err: unknown) =>
  err instanceof ApiError && err.status === 422
    ? (err.body as { error?: string } | undefined)?.error
    : undefined;

export function AddExpenseModal({ open, onOpenChange, onCreated }: AddExpenseModalProps) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [tab, setTab] = useState<'manual' | 'text' | 'file'>('manual');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [freeText, setFreeText] = useState('');
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCategoryId('');
    setAmount('');
    setDescription('');
    setDate(today);
    setFreeText('');
    setImportedFile(null);
    setImportResult(null);
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
      toast.error('Describe your expense first');
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

  const importFile = async () => {
    if (!importedFile) {
      toast.error('Choose a file first');
      return;
    }
    setSaving(true);
    try {
      const result = await importTransactionsFile(importedFile);
      setImportResult(result);
      if (result.imported.length > 0) onCreated?.();
    } catch (err) {
      const code = error422Code(err);
      if (code === 'no_categories') {
        toast.error(NO_CATEGORIES_MESSAGE);
      } else if (code === 'no_expenses') {
        toast.error(NO_EXPENSES_MESSAGE);
      } else if (code) {
        toast.error(INVALID_FILE_MESSAGE);
      } else {
        toast.error('Import failed — please try again');
      }
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'text' | 'file')}>
          <TabsList className="w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="text">
              <SparklesIcon /> Free text
            </TabsTrigger>
            <TabsTrigger value="file">
              <FileUpIcon /> Import file
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
            <p className="text-xs text-muted-foreground">
              The AI fills in amount, merchant, category and date — several expenses in one sentence
              become several transactions.
            </p>
          </TabsContent>
          <TabsContent value="file" className="space-y-3 pt-2">
            {importResult ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {importResult.imported.length} imported, {importResult.skipped.length} skipped
                </p>
                {importResult.skipped.length > 0 && (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {importResult.skipped.map((s) => (
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
                    setImportResult(null);
                    setImportedFile(null);
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
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon />{' '}
                  {importedFile ? importedFile.name : 'Choose a bank CSV or .txt notes file'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    setImportedFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Any bank CSV format or free-text notes (one expense per line) work — the AI fills
                  in amount, merchant, category and date per row. Credits and unreadable lines are
                  skipped and listed afterwards.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {tab === 'file' && importResult ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  void (tab === 'file' ? importFile() : tab === 'text' ? saveFreeText() : save())
                }
                disabled={saving}
              >
                {saving && <Loader2Icon className="size-4 animate-spin" />}
                {tab === 'file' ? (saving ? 'Importing…' : 'Import') : 'Add expense'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddExpenseModal;
