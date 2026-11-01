import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  ChevronDown,
  X,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Strikethrough,
} from 'lucide-react';
import { SendLaterPopover } from './SendLaterPopover';
import { senderApi, emailApi } from '../../api/client';
import { SenderAccount } from '../../types';
import { useToast } from '../../context/ToastContext';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onScheduled,
}) => {
  const { success, error } = useToast();
  const [senders, setSenders] = useState<SenderAccount[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [toInput, setToInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySec, setDelaySec] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(100);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      senderApi
        .getSenders()
        .then((data) => {
          setSenders(data);
          if (data.length > 0 && !selectedSenderId) {
            setSelectedSenderId(data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, selectedSenderId]);

  if (!isOpen) return null;

  // Add recipient on comma/enter/space
  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addRecipient(toInput);
    }
  };

  const addRecipient = (text: string) => {
    const rawEmails = text.split(/[\s,]+/);
    const validEmails = rawEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (validEmails.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...validEmails])));
      setToInput('');
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  // CSV / TXT list upload
  const handleListUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      // Extract all email regex matches
      const matches = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (matches && matches.length > 0) {
        const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
        setRecipients((prev) => Array.from(new Set([...prev, ...unique])));
        success(`Parsed and added ${unique.length} email addresses!`);
      } else {
        error('No valid email addresses found in file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Attachment upload
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    setAttachments((prev) => [...prev, { name: file.name, size: sizeStr }]);
  };

  // Rich Text Editor formatting commands
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  };

  const handleSend = async () => {
    const allRecipients = [...recipients];
    if (toInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toInput.trim())) {
      allRecipients.push(toInput.trim().toLowerCase());
    }

    if (allRecipients.length === 0) {
      error('Please specify at least one recipient');
      return;
    }
    if (!subject.trim()) {
      error('Subject line is required');
      return;
    }
    const finalBody = editorRef.current?.innerHTML || body;
    if (!finalBody.trim()) {
      error('Email body cannot be empty');
      return;
    }

    try {
      setSubmitting(true);
      const startTime = scheduledDate ? scheduledDate.toISOString() : new Date().toISOString();

      await emailApi.schedule({
        subject: subject.trim(),
        body: finalBody,
        recipients: allRecipients,
        startTime,
        delayBetweenSec: Number(delaySec) || 2,
        hourlyLimit: Number(hourlyLimit) || 100,
      });

      success(
        scheduledDate
          ? `Campaign scheduled for ${scheduledDate.toLocaleTimeString()}!`
          : `Dispatch started for ${allRecipients.length} recipients!`
      );
      onScheduled();
      onClose();
    } catch (err: any) {
      error(err.response?.data?.error || 'Failed to dispatch email campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > Date.now());

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-fade-in">
      {/* Header matching Figma */}
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">Compose New Email</h2>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-4 relative">
          {/* Attachment Paperclip Button */}
          <button
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
            className="relative p-1.5 text-gray-400 hover:text-gray-600 transition-all"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
            {attachments.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#00A854] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {attachments.length}
              </span>
            )}
          </button>
          <input
            type="file"
            ref={attachmentInputRef}
            onChange={handleAttachmentUpload}
            className="hidden"
          />

          {/* Clock icon: triggers Send Later popover */}
          <button
            type="button"
            onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
            className={`p-1.5 transition-all rounded-full ${
              isScheduled ? 'text-[#00A854] bg-emerald-50' : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Schedule send time"
          >
            <Clock className="w-5 h-5" />
          </button>

          {/* Send Later Popover */}
          {isSendLaterOpen && (
            <SendLaterPopover
              initialDate={scheduledDate || undefined}
              onSelectTime={(date) => {
                setScheduledDate(date);
                setIsSendLaterOpen(false);
                success(`Send scheduled for ${date.toLocaleString()}`);
              }}
              onCancel={() => {
                setScheduledDate(null);
                setIsSendLaterOpen(false);
              }}
            />
          )}

          {/* Send / Send Later pill button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting}
            className="px-6 py-1.5 rounded-full border border-[#10B981] bg-white hover:bg-emerald-50 active:bg-emerald-100 text-[#00A854] font-medium text-sm transition-all shadow-xs disabled:opacity-50"
          >
            {submitting ? 'Scheduling...' : isScheduled ? 'Send Later' : 'Send'}
          </button>
        </div>
      </div>

      {/* Main Form Fields Area */}
      <div className="flex-1 overflow-y-auto px-10 py-6 max-w-5xl mx-auto w-full">
        {/* From Field */}
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <span className="w-20 text-xs text-gray-500 font-medium">From</span>
          <div className="relative">
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-100 hover:border-gray-200 text-xs text-gray-800 rounded-lg px-3 py-1.5 pr-8 focus:outline-none cursor-pointer"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
              {senders.length === 0 && <option>Rotating Ethereal Senders (Auto)</option>}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* To Field with Recipient Chips & Upload List button */}
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <span className="w-20 text-xs text-gray-500 font-medium">To</span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[36px]">
            {/* Chips matching Figma pills with green borders */}
            {recipients.slice(0, 3).map((email, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-emerald-900 bg-white border border-[#10B981] shadow-xs"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {recipients.length > 3 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-emerald-900 bg-white border border-[#10B981] font-semibold">
                +{recipients.length - 3}
              </span>
            )}

            <input
              type="text"
              placeholder={recipients.length === 0 ? 'recipient@example.com' : 'Add more...'}
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleToKeyDown}
              onBlur={() => toInput && addRecipient(toInput)}
              className="flex-1 min-w-[200px] text-xs text-gray-800 placeholder-gray-400 focus:outline-none py-1"
            />
          </div>

          {/* Upload List Button matching Figma */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-[#00A854] hover:text-[#008a45] transition-all ml-3"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload List</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleListUpload}
            accept=".csv,.txt"
            className="hidden"
          />
        </div>

        {/* Subject Field */}
        <div className="flex items-center py-2.5 border-b border-gray-100">
          <span className="w-20 text-xs text-gray-500 font-medium">Subject</span>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none py-1"
          />
        </div>

        {/* Delay & Hourly Limit Inputs */}
        <div className="flex items-center py-3 border-b border-gray-100 gap-8">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Delay between 2 emails</span>
            <input
              type="number"
              min="0"
              placeholder="00"
              value={delaySec}
              onChange={(e) => setDelaySec(parseInt(e.target.value, 10) || 0)}
              className="w-16 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center text-gray-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400">sec</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Hourly Limit</span>
            <input
              type="number"
              min="1"
              placeholder="00"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
              className="w-16 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center text-gray-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400">emails/hr</span>
          </div>

          {isScheduled && (
            <div className="text-xs text-[#D97706] bg-[#FFF3E0] px-3 py-1 rounded-full font-medium flex items-center gap-1.5 ml-auto">
              <Clock className="w-3.5 h-3.5" />
              <span>Scheduled for {scheduledDate?.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Rich Text Editor Container */}
        <div className="mt-4 bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden flex flex-col min-h-[350px]">
          {/* Formatting Toolbar matching Figma */}
          <div className="flex items-center flex-wrap gap-1 px-4 py-2 bg-white border-b border-gray-100 text-gray-600">
            <button
              type="button"
              onClick={() => applyFormat('undo')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('redo')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => applyFormat('bold')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('italic')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('underline')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => applyFormat('justifyLeft')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('justifyCenter')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('justifyRight')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => applyFormat('insertOrderedList')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('insertUnorderedList')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => applyFormat('formatBlock', 'blockquote')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Quote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('formatBlock', 'pre')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Code"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('strikeThrough')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-700"
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Editable Content */}
          <div
            ref={editorRef}
            contentEditable
            onInput={(e) => setBody(e.currentTarget.innerHTML)}
            data-placeholder="Type Your Reply..."
            className="flex-1 p-6 text-sm text-gray-800 focus:outline-none min-h-[260px] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 leading-relaxed"
          />

          {/* Attachments Preview Area matching Figma */}
          {attachments.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-white flex flex-wrap gap-3">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700"
                >
                  <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium">{att.name}</span>
                  <span className="text-gray-400">({att.size})</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-gray-600 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

