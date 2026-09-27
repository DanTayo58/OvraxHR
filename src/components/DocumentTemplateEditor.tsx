import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Plus,
  Trash2,
  ListOrdered,
  FileText,
  Table as TableIcon,
  RotateCcw,
  CheckCircle2,
  Type,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Copy,
  PenTool,
  Image as ImageIcon,
  Palette,
  Upload,
  Check,
  Star,
  Tag,
  Briefcase,
  CheckSquare,
  Columns,
  Grid,
  Target,
  ArrowUpDown
} from 'lucide-react';
import {
  DocumentSection,
  DocumentSubsection,
  EnumerationFormat,
  DocumentItemType,
  DocumentHeaderMetaConfig,
  DocumentHeaderMetaItem,
  SignatureConfig,
  DocumentSignatureBlock
} from '../types';
import {
  DOCUMENT_TAGS,
  getPrefix,
  getListPrefix,
  replaceDocumentTags,
  getActiveOrganizationName,
  DEFAULT_HEADER_META,
  DEFAULT_SIGNATURES
} from '../utils/documentTemplates';

interface DocumentTemplateEditorProps {
  documentType: 'jd' | 'confirmation' | 'appointment' | 'appraisal' | 'offer';
  title: string;
  subtitle: string;
  colorScheme: 'teal' | 'blue' | 'indigo' | 'amber' | 'emerald';
  companyName: string;
  setCompanyName: (v: string) => void;
  registeredCompanyName?: string;
  documentTitle: string;
  setDocumentTitle: (v: string) => void;
  sections: DocumentSection[];
  setSections: (s: DocumentSection[]) => void;
  hrSigLabel: string;
  setHrSigLabel: (v: string) => void;
  empSigLabel: string;
  setEmpSigLabel: (v: string) => void;
  companyLogo?: string;
  setCompanyLogo?: (logo: string | undefined) => void;
  lineColor?: string;
  setLineColor?: (c: string) => void;
  textColor?: string;
  setTextColor?: (c: string) => void;
  headerMeta?: DocumentHeaderMetaConfig;
  setHeaderMeta?: (meta: DocumentHeaderMetaConfig) => void;
  signatures?: SignatureConfig;
  setSignatures?: (sigs: SignatureConfig) => void;
  onResetDefault: () => void;
  onSave: () => void;
  onBack: () => void;
  onClose: () => void;
}

// Exactly 6 distinct styling presets + 1 custom color option
const PRESET_LINE_COLORS = [
  { label: 'Amber Appraisal', hex: '#d97706' },
  { label: 'Teal Minimalist', hex: '#0d9488' },
  { label: 'Sapphire Executive', hex: '#2563eb' },
  { label: 'Indigo Modern', hex: '#4f46e5' },
  { label: 'Emerald Corporate', hex: '#059669' },
  { label: 'Deep Slate', hex: '#334155' },
];

const PRESET_TEXT_COLORS = [
  { label: 'Charcoal', hex: '#1e293b' },
  { label: 'Pure Black', hex: '#000000' },
  { label: 'Deep Navy', hex: '#0f172a' },
  { label: 'Dark Slate', hex: '#334155' },
  { label: 'Forest', hex: '#064e3b' },
  { label: 'Midnight Blue', hex: '#1e3a8a' },
];

export const DocumentTemplateEditor: React.FC<DocumentTemplateEditorProps> = ({
  documentType,
  title,
  subtitle,
  colorScheme,
  companyName,
  setCompanyName,
  registeredCompanyName = getActiveOrganizationName(),
  documentTitle,
  setDocumentTitle,
  sections,
  setSections,
  hrSigLabel,
  setHrSigLabel,
  empSigLabel,
  setEmpSigLabel,
  companyLogo,
  setCompanyLogo,
  lineColor = colorScheme === 'teal' ? '#0d9488' : colorScheme === 'blue' ? '#2563eb' : '#4f46e5',
  setLineColor,
  textColor = '#0f172a',
  setTextColor,
  headerMeta,
  setHeaderMeta,
  signatures,
  setSignatures,
  onResetDefault,
  onSave,
  onBack,
  onClose,
}) => {
  const lastActiveInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Color classes based on colorScheme
  const colorMap = {
    teal: {
      primary: 'teal',
      bgLight: 'bg-teal-950/40',
      borderLight: 'border-teal-800/80',
      textAccent: 'text-teal-400',
      btnPrimary: 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/30',
      tagBadge: 'bg-teal-950/80 border-teal-800 text-teal-300',
    },
    blue: {
      primary: 'blue',
      bgLight: 'bg-blue-950/40',
      borderLight: 'border-blue-800/80',
      textAccent: 'text-blue-400',
      btnPrimary: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30',
      tagBadge: 'bg-blue-950/80 border-blue-800 text-blue-300',
    },
    indigo: {
      primary: 'indigo',
      bgLight: 'bg-indigo-950/40',
      borderLight: 'border-indigo-800/80',
      textAccent: 'text-indigo-400',
      btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30',
      tagBadge: 'bg-indigo-950/80 border-indigo-800 text-indigo-300',
    },
    amber: {
      primary: 'amber',
      bgLight: 'bg-amber-950/40',
      borderLight: 'border-amber-800/80',
      textAccent: 'text-amber-400',
      btnPrimary: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30',
      tagBadge: 'bg-amber-950/80 border-amber-800 text-amber-300',
    },
    emerald: {
      primary: 'emerald',
      bgLight: 'bg-emerald-950/40',
      borderLight: 'border-emerald-800/80',
      textAccent: 'text-emerald-400',
      btnPrimary: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30',
      tagBadge: 'bg-emerald-950/80 border-emerald-800 text-emerald-300',
    },
  }[colorScheme];

  // Handle Logo Upload
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setCompanyLogo) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        if (result) {
          setCompanyLogo(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Smart Insert Tag at active input cursor position
  const smartInsertTag = (tag: string) => {
    const input = lastActiveInputRef.current;
    if (!input) {
      if (sections.length > 0 && sections[0].type === 'text') {
        const updated = [...sections];
        updated[0] = { ...updated[0], text: (updated[0].text || '') + ` ${tag}` };
        setSections(updated);
      }
      return;
    }

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;
    const updatedValue = val.substring(0, start) + tag + val.substring(end);
    
    // Set value and trigger synthetic events
    const nativeSetter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, updatedValue);
    } else {
      input.value = updatedValue;
    }

    const ev = new Event('input', { bubbles: true });
    input.dispatchEvent(ev);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + tag.length, start + tag.length);
    }, 10);
  };

  // Resolve active headerMeta with local state for instant preview reactivity
  const [activeHeaderMeta, setActiveHeaderMeta] = useState<DocumentHeaderMetaConfig>(
    () => headerMeta || DEFAULT_HEADER_META
  );

  useEffect(() => {
    if (headerMeta) {
      setActiveHeaderMeta(headerMeta);
    }
  }, [headerMeta]);

  const [selectedTagCategory, setSelectedTagCategory] = useState<'all' | 'ballot' | 'kpi' | 'staff' | 'remuneration'>('all');

  const defaultSigs = DEFAULT_SIGNATURES;
  const currentSignatures: SignatureConfig = signatures || defaultSigs;

  // Header Meta Handlers
  const handleUpdateHeaderMeta = (newMeta: DocumentHeaderMetaConfig) => {
    setActiveHeaderMeta(newMeta);
    if (setHeaderMeta) {
      setHeaderMeta(newMeta);
    }
  };

  const handleAddHeaderMetaItem = (side: 'left' | 'right') => {
    const newItem: DocumentHeaderMetaItem = {
      id: `meta-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      label: side === 'left' ? 'Field Label' : 'Reference Field',
      value: side === 'left' ? '{STAFF_NAME}' : '{ISSUE_DATE}',
    };
    if (side === 'left') {
      handleUpdateHeaderMeta({
        ...activeHeaderMeta,
        leftItems: [...(activeHeaderMeta.leftItems || []), newItem],
      });
    } else {
      handleUpdateHeaderMeta({
        ...activeHeaderMeta,
        rightItems: [...(activeHeaderMeta.rightItems || []), newItem],
      });
    }
  };

  const handleUpdateHeaderMetaItem = (side: 'left' | 'right', id: string, updates: Partial<DocumentHeaderMetaItem>) => {
    if (side === 'left') {
      handleUpdateHeaderMeta({
        ...activeHeaderMeta,
        leftItems: (activeHeaderMeta.leftItems || []).map((it) => (it.id === id ? { ...it, ...updates } : it)),
      });
    } else {
      handleUpdateHeaderMeta({
        ...activeHeaderMeta,
        rightItems: (activeHeaderMeta.rightItems || []).map((it) => (it.id === id ? { ...it, ...updates } : it)),
      });
    }
  };

  const handleDeleteHeaderMetaItem = (side: 'left' | 'right', id: string) => {
    if (side === 'left') {
      if ((activeHeaderMeta.leftItems || []).length <= 1) return;
      handleUpdateHeaderMeta({
        ...activeHeaderMeta,
        leftItems: (activeHeaderMeta.leftItems || []).filter((it) => it.id !== id),
      });
    } else {
      if ((activeHeaderMeta.rightItems || []).length <= 1) return;
      handleUpdateHeaderMeta({
        ...activeHeaderMeta,
        rightItems: (activeHeaderMeta.rightItems || []).filter((it) => it.id !== id),
      });
    }
  };

  const handleResetHeaderMeta = () => {
    handleUpdateHeaderMeta(DEFAULT_HEADER_META);
  };

  // Dynamic Signature Handlers
  const handleUpdateSignatures = (newSigs: SignatureConfig) => {
    if (setSignatures) {
      setSignatures(newSigs);
    }
    if (newSigs.signatures[0]?.title && setHrSigLabel) {
      setHrSigLabel(newSigs.signatures[0].title);
    }
    if (newSigs.signatures[1]?.title && setEmpSigLabel) {
      setEmpSigLabel(newSigs.signatures[1].title);
    }
  };

  const handleAddSignature = () => {
    const newSig: DocumentSignatureBlock = {
      id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: 'Authorized Department Head / Lead Representative',
      subtitle: 'Date: ____ / ____ / ________',
    };
    handleUpdateSignatures({
      ...currentSignatures,
      signatures: [...currentSignatures.signatures, newSig],
    });
  };

  const handleUpdateSignature = (id: string, updates: Partial<DocumentSignatureBlock>) => {
    handleUpdateSignatures({
      ...currentSignatures,
      signatures: currentSignatures.signatures.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const handleDeleteSignature = (id: string) => {
    if (currentSignatures.signatures.length <= 1) return;
    handleUpdateSignatures({
      ...currentSignatures,
      signatures: currentSignatures.signatures.filter((s) => s.id !== id),
    });
  };

  const handleChangeSignatureLayout = (layout: '1_col' | '2_col' | '3_col') => {
    handleUpdateSignatures({
      ...currentSignatures,
      layout,
    });
  };

  // Section Handlers
  const handleAddSection = (type: DocumentItemType = 'text') => {
    let title = 'New Operational Section';
    let text = 'Enter section description and terms here...';

    if (type === 'table') {
      title = 'Contract Specifications Table';
    } else if (type === 'jd_targets_table') {
      title = 'Job Description & Performance Targets Matrix';
      text = 'Performance deliverables evaluated against established operational targets and role weighting:';
    } else if (type === 'all_roles' || type === 'duties_list') {
      title = 'Core Role Responsibilities & Deliverables';
      text = 'The designated staff member is responsible for the following core deliverables:';
    } else if (type === 'key_roles') {
      title = 'Key Performance Indicators & Critical Responsibilities';
      text = 'The employee is directly accountable for the following primary key deliverables and KPI benchmarks:';
    } else if (type === 'normal_roles') {
      title = 'Routine Operational Duties & Procedures';
      text = 'The staff member shall execute the following standard operational and departmental procedures:';
    } else if (type === 'skills') {
      title = 'Designated Role Competencies & ATS Key Skills';
      text = 'The following key competencies and ATS verified skills are required for this role:';
    } else if (type === 'list') {
      title = 'Operational Guidelines & Requirements';
      text = '';
    }

    const newSec: DocumentSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      type,
      enumeration: 'roman',
      dutyFilter: type === 'jd_targets_table' ? 'all' : undefined,
      sortByWeight: type === 'jd_targets_table' ? true : undefined,
      heading: type === 'list' ? 'The employee is required to adhere to the following stipulations:' : undefined,
      text,
      listItems: type === 'list' ? [
        'Execute assigned duties in accordance with standards',
        'Comply with department benchmarks and safety requirements'
      ] : undefined,
      tableHeaders: type === 'jd_targets_table' ? [
        'Job Description / Duty',
        'Target / Metric',
        'Weight (%)',
        'Self Rating',
        'Supervisor Rating',
        'Remarks'
      ] : (type === 'table' ? ['Operational Parameter', 'Designated Specification'] : undefined),
      tableRows: type === 'table' ? [
        ['Assigned Staff Member', '{STAFF_NAME}'],
        ['Department & Designation', '{DEPARTMENT} • {ROLE_TITLE}'],
        ['Monthly Remuneration', '{SALARY}'],
        ['Effective Commencement', '{EFFECTIVE_DATE}']
      ] : undefined,
      subsections: [],
    };
    setSections([...sections, newSec]);
  };

  const handleUpdateSection = (id: string, updates: Partial<DocumentSection>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((s) => s.id !== id));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setSections(updated);
  };

  const handleMoveSubsection = (sectionId: string, subIndex: number, direction: 'up' | 'down') => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec || !sec.subsections) return;
    const newIdx = direction === 'up' ? subIndex - 1 : subIndex + 1;
    if (newIdx < 0 || newIdx >= sec.subsections.length) return;
    const updatedSubs = [...sec.subsections];
    const temp = updatedSubs[subIndex];
    updatedSubs[subIndex] = updatedSubs[newIdx];
    updatedSubs[newIdx] = temp;
    handleUpdateSection(sectionId, { subsections: updatedSubs });
  };

  // Section List Item Handlers
  const handleAddSectionListItem = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const items = [...(sec.listItems || []), 'New operational requirement / stipulation'];
    handleUpdateSection(sectionId, { listItems: items });
  };

  const handleUpdateSectionListItem = (sectionId: string, itemIdx: number, val: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const items = [...(sec.listItems || [])];
    items[itemIdx] = val;
    handleUpdateSection(sectionId, { listItems: items });
  };

  const handleDeleteSectionListItem = (sectionId: string, itemIdx: number) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const items = (sec.listItems || []).filter((_, idx) => idx !== itemIdx);
    handleUpdateSection(sectionId, { listItems: items });
  };

  // Section Table Column & Row Handlers
  const handleAddSectionColumn = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const currentHeaders = sec.tableHeaders && sec.tableHeaders.length > 0
      ? [...sec.tableHeaders]
      : ['Operational Parameter', 'Designated Specification'];
    const newHeaders = [...currentHeaders, `Column ${currentHeaders.length + 1}`];
    const currentRows = sec.tableRows && sec.tableRows.length > 0
      ? sec.tableRows.map((r) => [...r, ''])
      : [['', '']];
    handleUpdateSection(sectionId, {
      tableHeaders: newHeaders,
      tableRows: currentRows,
    });
  };

  const handleDeleteSectionColumn = (sectionId: string, colIndex: number) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec || !sec.tableHeaders || sec.tableHeaders.length <= 1) return;
    const newHeaders = sec.tableHeaders.filter((_, idx) => idx !== colIndex);
    const newRows = (sec.tableRows || []).map((r) => r.filter((_, idx) => idx !== colIndex));
    handleUpdateSection(sectionId, {
      tableHeaders: newHeaders,
      tableRows: newRows,
    });
  };

  const handleAddSectionRow = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const colCount = (sec.tableHeaders && sec.tableHeaders.length) || 2;
    const newRow = new Array(colCount).fill('');
    const newRows = [...(sec.tableRows || []), newRow];
    handleUpdateSection(sectionId, { tableRows: newRows });
  };

  const handleDeleteSectionRow = (sectionId: string, rowIndex: number) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const newRows = (sec.tableRows || []).filter((_, idx) => idx !== rowIndex);
    handleUpdateSection(sectionId, { tableRows: newRows });
  };

  // Subsection Handlers
  const handleAddSubsection = (sectionId: string, type: DocumentItemType = 'text') => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;

    let title = 'New Subsection Clause';
    let text: string | undefined = undefined;

    if (type === 'table') {
      title = 'Supplementary Specifications';
    } else if (type === 'jd_targets_table') {
      title = 'Job Description & Targets Matrix';
      text = 'Performance deliverables evaluated against established operational targets and role weighting:';
    } else if (type === 'list') {
      title = 'Clause Guidelines & Deliverables';
    } else if (type === 'all_roles' || type === 'duties_list') {
      title = 'Operational Deliverables';
      text = 'Assigned core departmental duties and responsibilities:';
    } else if (type === 'key_roles') {
      title = 'Key KPI Deliverables';
      text = 'Primary key performance indicators and critical responsibilities:';
    } else if (type === 'normal_roles') {
      title = 'Standard Operating Duties';
      text = 'Standard operational routine and procedural tasks:';
    } else if (type === 'skills') {
      title = 'Required ATS Key Skills';
      text = 'Mandatory ATS competencies and technical proficiencies:';
    } else {
      text = 'Provide detailed requirements or supplementary stipulations for this clause...';
    }

    const newSub: DocumentSubsection = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      type,
      enumeration: 'letters',
      dutyFilter: type === 'jd_targets_table' ? 'all' : undefined,
      sortByWeight: type === 'jd_targets_table' ? true : undefined,
      heading: type === 'list' ? 'The employee is required to adhere to the following stipulations:' : undefined,
      text,
      listItems: type === 'list' ? [
        'Execute assigned responsibilities in accordance with operational procedures',
        'Comply with quality benchmarks and safety requirements'
      ] : undefined,
      tableHeaders: type === 'jd_targets_table' ? [
        'Job Description / Duty',
        'Target / Metric',
        'Weight (%)',
        'Self Rating',
        'Supervisor Rating',
        'Remarks'
      ] : (type === 'table' ? ['Specification Item', 'Target / Requirement'] : undefined),
      tableRows: type === 'table' ? [['Delivery Timeline', 'Standard Operating Cycle'], ['Reporting Frequency', 'Weekly Direct Summary']] : undefined,
    };
    const updatedSubsections = [...(sec.subsections || []), newSub];
    handleUpdateSection(sectionId, { subsections: updatedSubsections });
  };

  const handleUpdateSubsection = (sectionId: string, subId: string, updates: Partial<DocumentSubsection>) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const updatedSubsections = (sec.subsections || []).map((sub) =>
      sub.id === subId ? { ...sub, ...updates } : sub
    );
    handleUpdateSection(sectionId, { subsections: updatedSubsections });
  };

  const handleDeleteSubsection = (sectionId: string, subId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const updatedSubsections = (sec.subsections || []).filter((sub) => sub.id !== subId);
    handleUpdateSection(sectionId, { subsections: updatedSubsections });
  };

  // Subsection List Item Handlers
  const handleAddSubsectionListItem = (sectionId: string, subId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub) return;
    const items = [...(sub.listItems || []), 'New list item / condition'];
    handleUpdateSubsection(sectionId, subId, { listItems: items });
  };

  const handleUpdateSubsectionListItem = (sectionId: string, subId: string, itemIdx: number, val: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub) return;
    const items = [...(sub.listItems || [])];
    items[itemIdx] = val;
    handleUpdateSubsection(sectionId, subId, { listItems: items });
  };

  const handleDeleteSubsectionListItem = (sectionId: string, subId: string, itemIdx: number) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub) return;
    const items = (sub.listItems || []).filter((_, idx) => idx !== itemIdx);
    handleUpdateSubsection(sectionId, subId, { listItems: items });
  };

  // Subsection Table Handlers
  const handleAddSubsectionColumn = (sectionId: string, subId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub) return;
    const currentHeaders = sub.tableHeaders && sub.tableHeaders.length > 0
      ? [...sub.tableHeaders]
      : ['Specification Item', 'Target / Requirement'];
    const newHeaders = [...currentHeaders, `Column ${currentHeaders.length + 1}`];
    const currentRows = sub.tableRows && sub.tableRows.length > 0
      ? sub.tableRows.map((r) => [...r, ''])
      : [['', '']];
    handleUpdateSubsection(sectionId, subId, {
      tableHeaders: newHeaders,
      tableRows: currentRows,
    });
  };

  const handleDeleteSubsectionColumn = (sectionId: string, subId: string, colIndex: number) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub || !sub.tableHeaders || sub.tableHeaders.length <= 1) return;
    const newHeaders = sub.tableHeaders.filter((_, idx) => idx !== colIndex);
    const newRows = (sub.tableRows || []).map((r) => r.filter((_, idx) => idx !== colIndex));
    handleUpdateSubsection(sectionId, subId, {
      tableHeaders: newHeaders,
      tableRows: newRows,
    });
  };

  const handleAddSubsectionRow = (sectionId: string, subId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub) return;
    const colCount = (sub.tableHeaders && sub.tableHeaders.length) || 2;
    const newRow = new Array(colCount).fill('');
    const newRows = [...(sub.tableRows || []), newRow];
    handleUpdateSubsection(sectionId, subId, { tableRows: newRows });
  };

  const handleDeleteSubsectionRow = (sectionId: string, subId: string, rowIndex: number) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const sub = (sec.subsections || []).find((s) => s.id === subId);
    if (!sub) return;
    const newRows = (sub.tableRows || []).filter((_, idx) => idx !== rowIndex);
    handleUpdateSubsection(sectionId, subId, { tableRows: newRows });
  };

  // Mock staff object for live preview
  const mockStaff = {
    id: 'staff-sample',
    employeeId: 'EMP-2026-08',
    name: 'Alexander Wright',
    department: 'Engineering & Technology',
    role: 'Senior Operations Lead',
    email: 'alexander@organization.com',
    phone: '+1 (555) 019-2834',
    payGrade: 'Grade A Executive',
    estimatedMonthlySalary: 6500,
    shiftSchedule: 'Standard Morning Rotation (08:00 - 17:00)',
    status: 'Active' as const,
    joinDate: '2026-01-15',
    bankName: 'First Global Premier Bank',
    accountNumber: '•••• •••• 9284',
  };

  const displayCompanyName = (companyName || registeredCompanyName || getActiveOrganizationName()).trim();

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full bg-${colorMap.primary}-500`}></span>
              <span>{title}</span>
            </h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Branding, Logo & Color Customizer Bar (Topmost Section) */}
      <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-700/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
            <Palette className="w-4 h-4 text-blue-400" />
            <span>Document Branding, Logo & Line Colors</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Applies to preview and printed official letters
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Logo Uploader */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300 font-mono uppercase">
              Company Logo (Centered at Top)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={logoInputRef}
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              {companyLogo ? (
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                  <img src={companyLogo} alt="Logo" className="h-6 max-w-[60px] object-contain" />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="text-[11px] font-bold text-blue-400 hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyLogo && setCompanyLogo(undefined)}
                    className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Add / Upload Logo</span>
                </button>
              )}
            </div>
          </div>

          {/* Letter Lines / Accent Color */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300 font-mono uppercase flex items-center justify-between">
              <span>Letter Lines & Accents</span>
              <span className="text-[10px] font-mono text-slate-400">{lineColor}</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_LINE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setLineColor && setLineColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                    lineColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-white scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={`${c.label} (${c.hex})`}
                >
                  {lineColor.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  )}
                </button>
              ))}
              {setLineColor && (
                <label
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 cursor-pointer hover:border-slate-500 transition"
                  title="Choose custom line & accent color"
                >
                  <span>Custom:</span>
                  <input
                    type="color"
                    value={lineColor}
                    onChange={(e) => setLineColor(e.target.value)}
                    className="w-4 h-4 rounded-full border-0 bg-transparent cursor-pointer"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Letter Text / Heading Color */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300 font-mono uppercase flex items-center justify-between">
              <span>Letter Text & Headings</span>
              <span className="text-[10px] font-mono text-slate-400">{textColor}</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_TEXT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setTextColor && setTextColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 transition cursor-pointer flex items-center justify-center ${
                    textColor.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-white scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={`${c.label} (${c.hex})`}
                >
                  {textColor.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  )}
                </button>
              ))}
              {setTextColor && (
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-6 h-6 rounded-full border border-slate-700 bg-transparent cursor-pointer ml-1"
                  title="Custom text color"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Head of the Letter (Document Header Metadata: Left & Right Slots) */}
      <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-700/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
            <Columns className="w-4 h-4 text-emerald-400" />
            <span>Document Header Metadata ("Head of the Letter" Left & Right Slots)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">
              Total control over employee, designation, issue date, and reference codes
            </span>
            <button
              type="button"
              onClick={handleResetHeaderMeta}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 border border-slate-700 cursor-pointer transition"
              title="Reset header slots to default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Slots</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Header Column */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200 font-mono uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                <span>Left Header Slot (Staff & Role Info)</span>
              </span>
              <button
                type="button"
                onClick={() => handleAddHeaderMetaItem('left')}
                className="px-2 py-0.5 rounded-md bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {(activeHeaderMeta.leftItems || []).map((item) => (
                <div key={item.id} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleUpdateHeaderMetaItem('left', item.id, { label: e.target.value })}
                      placeholder="Label (e.g. Designated Staff)"
                      className="w-1/3 px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-teal-300 font-semibold outline-none focus:border-teal-500"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onChange={(e) => handleUpdateHeaderMetaItem('left', item.id, { value: e.target.value })}
                      placeholder="Value or tag (e.g. {STAFF_NAME})"
                      className="flex-1 px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteHeaderMetaItem('left', item.id)}
                      disabled={(activeHeaderMeta.leftItems || []).length <= 1}
                      className="p-1 rounded text-rose-400 hover:bg-rose-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Delete this meta row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Header Column */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200 font-mono uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Right Header Slot (Dates & Reference)</span>
              </span>
              <button
                type="button"
                onClick={() => handleAddHeaderMetaItem('right')}
                className="px-2 py-0.5 rounded-md bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {(activeHeaderMeta.rightItems || []).map((item) => (
                <div key={item.id} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleUpdateHeaderMetaItem('right', item.id, { label: e.target.value })}
                      placeholder="Label (e.g. Issue Date)"
                      className="w-1/3 px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-blue-300 font-semibold outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onChange={(e) => handleUpdateHeaderMetaItem('right', item.id, { value: e.target.value })}
                      placeholder="Value or tag (e.g. {ISSUE_DATE})"
                      className="flex-1 px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteHeaderMetaItem('right', item.id)}
                      disabled={(activeHeaderMeta.rightItems || []).length <= 1}
                      className="p-1 rounded text-rose-400 hover:bg-rose-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Delete this meta row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Tag Inserters (Moved under Document Header Metadata) */}
      <div className={`p-3.5 rounded-2xl ${colorMap.bgLight} border ${colorMap.borderLight} space-y-2.5`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-200">
            <Sparkles className={`w-4 h-4 ${colorMap.textAccent}`} />
            <span>Dynamic Tag Palette (Click to insert at cursor position)</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700/80">
            {(documentType === 'appraisal'
              ? [
                  { id: 'all', label: 'All Tags' },
                  { id: 'ballot', label: '☐ Ballot Box' },
                  { id: 'kpi', label: '🎯 KPIs & Targets' },
                  { id: 'staff', label: '👤 Staff & Role' },
                  { id: 'remuneration', label: '💼 Remuneration' },
                ]
              : [
                  { id: 'all', label: 'All Tags' },
                  { id: 'kpi', label: '🎯 Roles & Duties' },
                  { id: 'staff', label: '👤 Staff & Role' },
                  { id: 'remuneration', label: '💼 Remuneration' },
                ]
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedTagCategory(cat.id as any)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                  selectedTagCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {DOCUMENT_TAGS.filter((item) => {
            // Ballot Box tag is ONLY available in Appraisal & KPI template alone
            if (item.tag === '☐' && documentType !== 'appraisal') return false;

            const isBallot = item.tag === '☐';
            const isKpi = item.tag === '{TARGETS}' || item.tag === '{JOB_SUMMARY}' || item.tag.includes('DUTIES') || item.tag.includes('ROLES') || item.tag.includes('SKILLS');
            const isStaff = item.tag === '{STAFF_NAME}' || item.tag === '{ROLE_TITLE}' || item.tag === '{DEPARTMENT}' || item.tag === '{EMPLOYEE_ID}' || item.tag === '{STATUS}' || item.tag === '{REPORTS_TO}' || item.tag === '{SHIFT_SCHEDULE}' || item.tag === '{JOIN_DATE}' || item.tag === '{EMAIL}' || item.tag === '{PHONE}';
            const isRemun = item.tag === '{SALARY}' || item.tag === '{SALARY_SUMMARY}' || item.tag === '{PAY_GRADE}' || item.tag === '{BANK_NAME}' || item.tag === '{ACCOUNT_NUMBER}' || item.tag === '{COMPANY_NAME}' || item.tag === '{DATE}';

            if (selectedTagCategory === 'ballot') return isBallot;
            if (selectedTagCategory === 'kpi') return isKpi;
            if (selectedTagCategory === 'staff') return isStaff;
            if (selectedTagCategory === 'remuneration') return isRemun;
            return true;
          }).map((item) => {
            const isBallot = item.tag === '☐';
            return (
              <button
                key={item.tag}
                type="button"
                onClick={() => smartInsertTag(item.tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition hover:scale-105 cursor-pointer shadow-sm flex items-center gap-1 ${
                  isBallot
                    ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 ring-1 ring-amber-500/30 font-bold'
                    : colorMap.tagBadge
                }`}
                title={`Insert ${item.label}`}
              >
                {isBallot ? (
                  <>
                    <span className="text-sm leading-none">☐</span>
                    <span className="text-[10px] text-amber-400/90 font-sans">Ballot Box</span>
                  </>
                ) : (
                  <span>{item.tag}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Area: Left Editor (7 cols), Right Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Letterhead & Title Inputs */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <h4 className={`text-xs font-bold ${colorMap.textAccent} font-mono uppercase tracking-wider`}>
              Letterhead Header & Document Title
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Company / Organization Name Header
                </label>
                <input
                  type="text"
                  value={companyName}
                  onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                  onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                  onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={registeredCompanyName || getActiveOrganizationName()}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Document Header Title
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                  onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                  onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Official Letter / Job Description Title"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Sections Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Document Sections & Clauses ({sections.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                Minimum 1 section
              </span>
            </div>

            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3 shadow-md"
              >
                {/* Section Title Row: Reorder Chevrons (Left), Title Input, Delete Button (Right) */}
                <div className="flex items-center gap-2">
                  {/* Left: Section Index & Move Chevrons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-slate-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition"
                        title="Move Section Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 'down')}
                        disabled={idx === sections.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition"
                        title="Move Section Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title Input Field */}
                  <input
                    type="text"
                    value={sec.title}
                    onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                    onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                    onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                    onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                    placeholder="Section Title (e.g. Terms of Employment)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-bold outline-none focus:border-blue-500 min-w-0"
                  />

                  {/* Right: Delete Section Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(sec.id)}
                    disabled={sections.length <= 1}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0 transition"
                    title={sections.length <= 1 ? "A template requires at least 1 section" : "Delete Section"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dropdowns Row Directly Under Title: Section Type & Enumeration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  {/* Section Content Type Selector Dropdown */}
                  <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700 min-w-0">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold shrink-0">Section Type:</span>
                    <select
                      value={sec.type || 'text'}
                      onChange={(e) => {
                        const newType = e.target.value as DocumentItemType;
                        const updates: Partial<DocumentSection> = { type: newType };
                        if (newType === 'jd_targets_table') {
                          updates.dutyFilter = sec.dutyFilter || 'all';
                          updates.sortByWeight = sec.sortByWeight !== undefined ? sec.sortByWeight : true;
                          if (!sec.tableHeaders || sec.tableHeaders.length === 0) {
                            updates.tableHeaders = [
                              'Job Description / Duty',
                              'Target / Metric',
                              'Weight (%)',
                              'Self Rating',
                              'Supervisor Rating',
                              'Remarks'
                            ];
                          }
                          if (!sec.text) {
                            updates.text = 'Performance deliverables evaluated against established operational targets and role weighting:';
                          }
                        }
                        if (newType === 'list' && (!sec.listItems || sec.listItems.length === 0)) {
                          updates.listItems = ['Operational requirement item 1', 'Compliance standard item 2'];
                          if (!sec.heading) updates.heading = 'The employee must adhere to the following stipulations:';
                        }
                        if (newType === 'table' && (!sec.tableHeaders || sec.tableHeaders.length === 0)) {
                          updates.tableHeaders = ['Operational Parameter', 'Designated Specification'];
                          updates.tableRows = [
                            ['Assigned Staff Member', '{STAFF_NAME}'],
                            ['Department & Designation', '{DEPARTMENT} • {ROLE_TITLE}']
                          ];
                        }
                        if ((newType === 'all_roles' || newType === 'duties_list') && !sec.text) {
                          updates.text = 'The designated staff member is responsible for the following core deliverables:';
                        }
                        if (newType === 'key_roles' && !sec.text) {
                          updates.text = 'The employee is directly accountable for the following primary key deliverables and KPI benchmarks:';
                        }
                        if (newType === 'normal_roles' && !sec.text) {
                          updates.text = 'The staff member shall execute the following standard operational and departmental procedures:';
                        }
                        if (newType === 'skills' && !sec.text) {
                          updates.text = 'The following key competencies and ATS verified skills are required for this role:';
                        }
                        handleUpdateSection(sec.id, updates);
                      }}
                      className="text-xs bg-transparent text-teal-300 font-bold outline-none cursor-pointer flex-1 min-w-0 truncate"
                      title="Change Section Content Type"
                    >
                      <option value="text" className="bg-slate-900 text-white">Paragraph Text</option>
                      {documentType === 'appraisal' && (
                        <option value="jd_targets_table" className="bg-slate-900 text-amber-300 font-bold">JD - Target Table (Roles & Targets)</option>
                      )}
                      <option value="all_roles" className="bg-slate-900 text-teal-300">All Roles (All Deliverables)</option>
                      <option value="key_roles" className="bg-slate-900 text-amber-300">Key Roles (Key KPIs)</option>
                      <option value="normal_roles" className="bg-slate-900 text-sky-300">Normal Roles (Non-Key)</option>
                      <option value="skills" className="bg-slate-900 text-purple-300">Role ATS Key Skills</option>
                      <option value="list" className="bg-slate-900 text-emerald-300">Custom List</option>
                      <option value="table" className="bg-slate-900 text-indigo-300">Specifications Table</option>
                      {sec.type === 'duties_list' && <option value="duties_list" className="bg-slate-900 text-teal-300">All Roles (Legacy Ref)</option>}
                    </select>
                  </div>

                  {/* Enumeration picker */}
                  <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700 min-w-0">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold shrink-0">Enumeration:</span>
                    <select
                      value={sec.enumeration || 'roman'}
                      onChange={(e) => handleUpdateSection(sec.id, { enumeration: e.target.value as EnumerationFormat })}
                      className="text-xs bg-transparent text-slate-200 font-mono outline-none cursor-pointer flex-1 min-w-0 truncate"
                      title="Enumeration Prefix Style"
                    >
                      <option value="roman" className="bg-slate-900 text-white">Roman (I, II, III)</option>
                      <option value="numbers" className="bg-slate-900 text-white">Numbers (1, 2, 3)</option>
                      <option value="letters" className="bg-slate-900 text-white">Letters (a, b, c)</option>
                      <option value="dots" className="bg-slate-900 text-white">Bullet Dots (•)</option>
                      <option value="none" className="bg-slate-900 text-white">No Prefix</option>
                    </select>
                  </div>
                </div>

                {/* Section Content Type Render */}
                {(sec.type === 'text' || sec.type === 'all_roles' || sec.type === 'key_roles' || sec.type === 'normal_roles' || sec.type === 'skills' || sec.type === 'duties_list') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-mono text-slate-400">
                        {sec.type === 'all_roles' || sec.type === 'duties_list'
                          ? 'All Roles (All Deliverables) Introductory Statement'
                          : sec.type === 'key_roles'
                          ? 'Key Roles (Key KPIs & Deliverables) Introductory Statement'
                          : sec.type === 'normal_roles'
                          ? 'Normal Roles (Standard / Non-Key) Introductory Statement'
                          : sec.type === 'skills'
                          ? 'Role ATS Key Skills Introductory Statement'
                          : 'Section Paragraph / Clause Terms'}
                      </label>
                      {sec.type !== 'text' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          sec.type === 'key_roles'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                            : sec.type === 'skills'
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/80'
                            : sec.type === 'normal_roles'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-800/80'
                            : 'bg-teal-950/60 text-teal-300 border-teal-800/80'
                        }`}>
                          Dynamic Role Section
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={sec.type === 'text' ? 3 : 2}
                      value={sec.text || ''}
                      onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                      onChange={(e) => handleUpdateSection(sec.id, { text: e.target.value })}
                      placeholder="Enter clause narrative, policy statements, or introductory parameters..."
                      className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-blue-500 leading-relaxed font-sans"
                    />
                    {sec.type !== 'text' && (
                      <p className="text-[10.5px] text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>
                          {sec.type === 'all_roles' || sec.type === 'duties_list'
                            ? 'In the generated document, this section automatically renders all role deliverables configured in the Department Role records.'
                            : sec.type === 'key_roles'
                            ? 'In the generated document, this section automatically filters and renders only the designated Key Roles / Primary KPIs.'
                            : sec.type === 'normal_roles'
                            ? 'In the generated document, this section automatically filters and renders standard non-key routine operational duties.'
                            : 'In the generated document, this section automatically extracts and renders the ATS Key Skills configured for each duty in this role.'}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {/* Section List Type */}
                {sec.type === 'list' && (
                  <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Section List Heading / Introductory Line
                      </label>
                      <input
                        type="text"
                        value={sec.heading || ''}
                        onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onChange={(e) => handleUpdateSection(sec.id, { heading: e.target.value })}
                        placeholder="e.g. The employee must adhere to the following stipulations:"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-medium outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Enumeration:</span>
                        <select
                          value={sec.enumeration || 'dots'}
                          onChange={(e) => handleUpdateSection(sec.id, { enumeration: e.target.value as EnumerationFormat })}
                          className="px-2 py-0.5 text-[11px] rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono outline-none"
                        >
                          <option value="dots">Bullet Dots (•)</option>
                          <option value="numbers">Numbers (1, 2, 3)</option>
                          <option value="letters">Letters (a, b, c)</option>
                          <option value="roman">Roman (i, ii, iii)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddSectionListItem(sec.id)}
                        className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Plus className="w-3 h-3" /> Add List Item (+)
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {(sec.listItems && sec.listItems.length > 0 ? sec.listItems : ['Operational deliverable requirement']).map((item, itemIdx) => {
                        const itemPrefix = getPrefix(itemIdx, sec.enumeration || 'letters', true);
                        return (
                          <div key={itemIdx} className="flex items-center gap-2">
                            <span className="w-6 text-right text-xs font-mono font-bold text-emerald-400 shrink-0">
                              {itemPrefix || '•'}
                            </span>
                            <input
                              type="text"
                              value={item}
                              onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onChange={(e) => handleUpdateSectionListItem(sec.id, itemIdx, e.target.value)}
                              placeholder="Describe deliverable requirement or condition..."
                              className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteSectionListItem(sec.id, itemIdx)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer shrink-0"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sec.type === 'table' && (
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-indigo-400">
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>Section Table Specifications</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddSectionColumn(sec.id)}
                          className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Add a new column to this table"
                        >
                          <Plus className="w-3 h-3" /> Add Column
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddSectionRow(sec.id)}
                          className="px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Add a new row to this table"
                        >
                          <Plus className="w-3 h-3" /> Add Row
                        </button>
                      </div>
                    </div>

                    {/* Table Column Headers */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase text-slate-400">
                        Column Headers ({((sec.tableHeaders && sec.tableHeaders.length) || 2)} Columns)
                      </label>
                      <div className="flex items-center gap-2">
                        {((sec.tableHeaders && sec.tableHeaders.length > 0)
                          ? sec.tableHeaders
                          : ['Operational Parameter', 'Designated Specification']
                        ).map((header, colIdx) => (
                          <div key={colIdx} className="flex-1 flex items-center gap-1">
                            <input
                              type="text"
                              value={header}
                              onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onChange={(e) => {
                                const currentHeaders = sec.tableHeaders && sec.tableHeaders.length > 0
                                  ? [...sec.tableHeaders]
                                  : ['Operational Parameter', 'Designated Specification'];
                                currentHeaders[colIdx] = e.target.value;
                                handleUpdateSection(sec.id, { tableHeaders: currentHeaders });
                              }}
                              placeholder={`Header ${colIdx + 1}`}
                              className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-indigo-200 font-bold outline-none focus:border-indigo-500"
                            />
                            {(sec.tableHeaders && sec.tableHeaders.length > 1) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSectionColumn(sec.id, colIdx)}
                                className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer"
                                title={`Delete Column ${colIdx + 1}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Table Rows */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[10px] font-mono uppercase text-slate-400">
                        Table Rows ({(sec.tableRows || []).length})
                      </label>
                      {(sec.tableRows || []).map((row, rIdx) => {
                        const colCount = (sec.tableHeaders && sec.tableHeaders.length) || 2;
                        return (
                          <div key={rIdx} className="flex items-center gap-2">
                            {Array.from({ length: colCount }).map((_, cIdx) => (
                              <input
                                key={cIdx}
                                type="text"
                                value={row[cIdx] || ''}
                                onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                onChange={(e) => {
                                  const newRows = (sec.tableRows || []).map((r) => [...r]);
                                  if (!newRows[rIdx]) newRows[rIdx] = [];
                                  newRows[rIdx][cIdx] = e.target.value;
                                  handleUpdateSection(sec.id, { tableRows: newRows });
                                }}
                                placeholder={cIdx === 0 ? 'Parameter Name' : 'Tag or Value (e.g. {SALARY})'}
                                className={`flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-blue-500 ${cIdx > 0 ? 'font-mono' : ''}`}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => handleDeleteSectionRow(sec.id, rIdx)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* If Section Type is JD - Targets Table */}
                {sec.type === 'jd_targets_table' && (
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/40">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-amber-400">
                        <Target className="w-3.5 h-3.5" />
                        <span>JD - Target Table Configuration</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const currentHeaders = sec.tableHeaders && sec.tableHeaders.length > 0
                              ? [...sec.tableHeaders]
                              : ['Job Description / Duty', 'Target / Metric', 'Weight (%)', 'Self Rating', 'Supervisor Rating', 'Remarks'];
                            const newHeaders = [...currentHeaders, `Column ${currentHeaders.length + 1}`];
                            const newRows = (sec.tableRows || []).map((row) => [...row, '']);
                            handleUpdateSection(sec.id, {
                              tableHeaders: newHeaders,
                              tableRows: newRows,
                            });
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Add a new custom column (e.g. Score, Scale, Notes)"
                        >
                          <Plus className="w-3 h-3" /> Add Column
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const colCount = (sec.tableHeaders && sec.tableHeaders.length) || 6;
                            const newRow = new Array(colCount).fill('');
                            const newRows = [...(sec.tableRows || []), newRow];
                            handleUpdateSection(sec.id, { tableRows: newRows });
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Add an extra fixed evaluation or KPI row"
                        >
                          <Plus className="w-3 h-3" /> Add Custom Row
                        </button>
                      </div>
                    </div>

                    {/* Controls Row: Duty Filter & Arrangement by Weights */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                      {/* 1. Duties Filter Selector */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold">
                          Display Duties Scope:
                        </label>
                        <div className="flex items-center gap-1">
                          {(['all', 'key', 'normal'] as const).map((filterVal) => {
                            const isActive = (sec.dutyFilter || 'all') === filterVal;
                            const label = filterVal === 'all' ? 'All Duties' : filterVal === 'key' ? 'Key Duties' : 'Normal Duties';
                            return (
                              <button
                                key={filterVal}
                                type="button"
                                onClick={() => handleUpdateSection(sec.id, { dutyFilter: filterVal })}
                                className={`flex-1 py-1 px-2 rounded text-[11px] font-bold transition cursor-pointer border ${
                                  isActive
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Sort by Weights Arrangement */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono uppercase text-slate-400 font-bold">
                          Arrangement & Sorting:
                        </label>
                        <button
                          type="button"
                          onClick={() => handleUpdateSection(sec.id, { sortByWeight: sec.sortByWeight === false ? true : false })}
                          className={`w-full py-1 px-2.5 rounded text-[11px] font-bold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                            sec.sortByWeight !== false
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                          title="Toggle arrangement of duties by role weight"
                        >
                          <ArrowUpDown className="w-3 h-3 text-amber-400" />
                          <span>{sec.sortByWeight !== false ? 'Arranged by Weights (Highest First)' : 'Natural Role Order'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Table Column Headers */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                        <span>Table Columns ({((sec.tableHeaders && sec.tableHeaders.length) || 6)} Columns)</span>
                        <span className="text-[9.5px] text-amber-400/80">Columns 1-3 map to JD, Targets & Weights</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {((sec.tableHeaders && sec.tableHeaders.length > 0)
                          ? sec.tableHeaders
                          : ['Job Description / Duty', 'Target / Metric', 'Weight (%)', 'Self Rating', 'Supervisor Rating', 'Remarks']
                        ).map((header, colIdx) => (
                          <div key={colIdx} className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono font-bold text-slate-500 w-4 text-center">{colIdx + 1}</span>
                            <input
                              type="text"
                              value={header}
                              onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onChange={(e) => {
                                const currentHeaders = sec.tableHeaders && sec.tableHeaders.length > 0
                                  ? [...sec.tableHeaders]
                                  : ['Job Description / Duty', 'Target / Metric', 'Weight (%)', 'Self Rating', 'Supervisor Rating', 'Remarks'];
                                currentHeaders[colIdx] = e.target.value;
                                handleUpdateSection(sec.id, { tableHeaders: currentHeaders });
                              }}
                              placeholder={`Header ${colIdx + 1}`}
                              className="w-full px-2 py-0.5 text-[11px] rounded bg-transparent text-amber-200 font-bold outline-none focus:text-white"
                            />
                            {colIdx >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const currentHeaders = sec.tableHeaders && sec.tableHeaders.length > 0
                                    ? [...sec.tableHeaders]
                                    : ['Job Description / Duty', 'Target / Metric', 'Weight (%)', 'Self Rating', 'Supervisor Rating', 'Remarks'];
                                  const newHeaders = currentHeaders.filter((_, idx) => idx !== colIdx);
                                  const newRows = (sec.tableRows || []).map((row) => row.filter((_, idx) => idx !== colIdx));
                                  handleUpdateSection(sec.id, { tableHeaders: newHeaders, tableRows: newRows });
                                }}
                                className="p-0.5 rounded text-rose-400 hover:bg-rose-950 cursor-pointer shrink-0"
                                title={`Delete Column "${header}"`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Extra Rows (if any) */}
                    {(sec.tableRows && sec.tableRows.length > 0) && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[10px] font-mono uppercase text-slate-400">
                          Additional Criteria Rows ({sec.tableRows.length})
                        </label>
                        {sec.tableRows.map((row, rIdx) => {
                          const colCount = (sec.tableHeaders && sec.tableHeaders.length) || 6;
                          return (
                            <div key={rIdx} className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                              {Array.from({ length: colCount }).map((_, cIdx) => (
                                <input
                                  key={cIdx}
                                  type="text"
                                  value={row[cIdx] || ''}
                                  onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                  onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                  onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                  onChange={(e) => {
                                    const newRows = (sec.tableRows || []).map((r) => [...r]);
                                    if (!newRows[rIdx]) newRows[rIdx] = [];
                                    newRows[rIdx][cIdx] = e.target.value;
                                    handleUpdateSection(sec.id, { tableRows: newRows });
                                  }}
                                  placeholder={cIdx === 0 ? 'Custom Duty / Criteria' : cIdx === 1 ? 'Target Metric' : cIdx === 2 ? 'Weight' : 'Value / Blank'}
                                  className="flex-1 px-2 py-0.5 text-[11px] rounded bg-slate-900 border border-slate-700 text-white outline-none focus:border-amber-500"
                                />
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  const newRows = (sec.tableRows || []).filter((_, idx) => idx !== rIdx);
                                  handleUpdateSection(sec.id, { tableRows: newRows });
                                }}
                                className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer"
                                title="Delete Row"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Subsections under this section */}
                <div className="pl-3 border-l-2 border-slate-700 space-y-3 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span className="font-mono uppercase text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Subsections / Clauses ({(sec.subsections || []).length})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {(sec.subsections || []).length === 0 ? 'No subsections added' : `${(sec.subsections || []).length} active`}
                    </span>
                  </div>

                  {(sec.subsections || []).map((sub, subIdx) => {
                    const subType = sub.type || 'text';
                    const subsCount = (sec.subsections || []).length;
                    return (
                      <div key={sub.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2.5">
                        {/* Subsection Title Row: Reorder Chevrons (Left), Subtitle Input, Delete Button (Right) */}
                        <div className="flex items-center gap-2">
                          {/* Left: Reorder chevrons & index */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="w-5 h-5 rounded-md bg-slate-950 text-slate-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                              {subIdx + 1}
                            </span>
                            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-700/80 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveSubsection(sec.id, subIdx, 'up')}
                                disabled={subIdx === 0}
                                className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition"
                                title="Move Subsection Up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSubsection(sec.id, subIdx, 'down')}
                                disabled={subIdx === subsCount - 1}
                                className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition"
                                title="Move Subsection Down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Subtitle Input Field */}
                          <input
                            type="text"
                            value={sub.title}
                            onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                            onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                            onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                            onChange={(e) => handleUpdateSubsection(sec.id, sub.id, { title: e.target.value })}
                            placeholder="Subsection Title (e.g. Mandatory Guidelines)"
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white font-bold outline-none focus:border-blue-500 min-w-0"
                          />

                          {/* Right: Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSubsection(sec.id, sub.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg border border-slate-700/60 cursor-pointer transition shrink-0"
                            title="Delete Subsection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Dropdowns Row under Subtitle: Type & Enumeration */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                          {/* Subsection Type Selector Dropdown */}
                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 min-w-0">
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold shrink-0">Type:</span>
                            <select
                              value={subType}
                              onChange={(e) => {
                                const newType = e.target.value as DocumentItemType;
                                const updates: Partial<DocumentSubsection> = { type: newType };
                                if (newType === 'jd_targets_table') {
                                  updates.dutyFilter = sub.dutyFilter || 'all';
                                  updates.sortByWeight = sub.sortByWeight !== undefined ? sub.sortByWeight : true;
                                  if (!sub.tableHeaders || sub.tableHeaders.length === 0) {
                                    updates.tableHeaders = [
                                      'Job Description / Duty',
                                      'Target / Metric',
                                      'Weight (%)',
                                      'Self Rating',
                                      'Supervisor Rating',
                                      'Remarks'
                                    ];
                                  }
                                  if (!sub.text) {
                                    updates.text = 'Performance deliverables evaluated against established operational targets and role weighting:';
                                  }
                                }
                                if (newType === 'list' && (!sub.listItems || sub.listItems.length === 0)) {
                                  updates.listItems = ['Operational requirement item 1', 'Compliance standard item 2'];
                                  if (!sub.heading) updates.heading = 'The employee must adhere to the following stipulations:';
                                }
                                if (newType === 'table' && (!sub.tableHeaders || sub.tableHeaders.length === 0)) {
                                  updates.tableHeaders = ['Specification Item', 'Target / Requirement'];
                                  updates.tableRows = [['Delivery Timeline', 'Standard Operating Cycle'], ['Reporting Frequency', 'Weekly Direct Summary']];
                                }
                                if ((newType === 'all_roles' || newType === 'duties_list') && !sub.text) {
                                  updates.text = 'Assigned core departmental duties and responsibilities:';
                                }
                                if (newType === 'key_roles' && !sub.text) {
                                  updates.text = 'Primary key performance indicators and critical responsibilities:';
                                }
                                if (newType === 'normal_roles' && !sub.text) {
                                  updates.text = 'Standard operational routine and procedural tasks:';
                                }
                                if (newType === 'skills' && !sub.text) {
                                  updates.text = 'Mandatory ATS competencies and technical proficiencies:';
                                }
                                handleUpdateSubsection(sec.id, sub.id, updates);
                              }}
                              className="text-xs bg-transparent text-teal-300 font-bold outline-none cursor-pointer flex-1 min-w-0 truncate"
                              title="Select Subsection Type"
                            >
                              <option value="text" className="bg-slate-900 text-white">Paragraph Text</option>
                              {documentType === 'appraisal' && (
                                <option value="jd_targets_table" className="bg-slate-900 text-amber-300 font-bold">JD - Target Table (Roles & Targets)</option>
                              )}
                              <option value="all_roles" className="bg-slate-900 text-teal-300">All Roles (All Deliverables)</option>
                              <option value="key_roles" className="bg-slate-900 text-amber-300">Key Roles (Key KPIs)</option>
                              <option value="normal_roles" className="bg-slate-900 text-sky-300">Normal Roles (Non-Key)</option>
                              <option value="skills" className="bg-slate-900 text-purple-300">Role ATS Key Skills</option>
                              <option value="list" className="bg-slate-900 text-emerald-300">Bulleted / Numbered List</option>
                              <option value="table" className="bg-slate-900 text-indigo-300">Table</option>
                              {subType === 'duties_list' && <option value="duties_list" className="bg-slate-900 text-teal-300">All Roles (Legacy Ref)</option>}
                            </select>
                          </div>

                          {/* Enumeration Format Dropdown */}
                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 min-w-0">
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold shrink-0">Prefix:</span>
                            <select
                              value={sub.enumeration || 'letters'}
                              onChange={(e) => handleUpdateSubsection(sec.id, sub.id, { enumeration: e.target.value as EnumerationFormat })}
                              className="text-xs bg-transparent text-slate-200 font-mono outline-none cursor-pointer flex-1 min-w-0 truncate"
                              title="Subsection Enumeration Style"
                            >
                              <option value="letters" className="bg-slate-900 text-white">Letters (a, b, c)</option>
                              <option value="numbers" className="bg-slate-900 text-white">Numbers (1, 2, 3)</option>
                              <option value="roman" className="bg-slate-900 text-white">Roman (i, ii, iii)</option>
                              <option value="dots" className="bg-slate-900 text-white">Bullet Dots (•)</option>
                              <option value="none" className="bg-slate-900 text-white">No Prefix</option>
                            </select>
                          </div>
                        </div>

                        {/* If Subsection Type is 'text' */}
                        {subType === 'text' && (
                          <textarea
                            rows={2}
                            value={sub.text || ''}
                            onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                            onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                            onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                            onChange={(e) => handleUpdateSubsection(sec.id, sub.id, { text: e.target.value })}
                            placeholder="Subsection description / clause content..."
                            className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none leading-relaxed focus:border-blue-500 font-sans"
                          />
                        )}

                        {/* If Subsection Type is 'list' */}
                        {subType === 'list' && (
                          <div className="space-y-2.5">
                            {/* Heading Underneath Subsection Title */}
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                Subsection Heading / Introductory Line
                              </label>
                              <input
                                type="text"
                                value={sub.heading || ''}
                                onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                onChange={(e) => handleUpdateSubsection(sec.id, sub.id, { heading: e.target.value })}
                                placeholder="e.g. Below are the key requirements under this clause:"
                                className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-medium outline-none focus:border-teal-500"
                              />
                            </div>

                            {/* Tools Panel for Subsection List */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono uppercase text-teal-400 font-bold">Enumeration:</span>
                                <select
                                  value={sub.enumeration || 'dots'}
                                  onChange={(e) => handleUpdateSubsection(sec.id, sub.id, { enumeration: e.target.value as EnumerationFormat })}
                                  className="px-2 py-0.5 text-[11px] rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono outline-none"
                                >
                                  <option value="dots">Bullet Dots (•)</option>
                                  <option value="numbers">Numbers (1, 2, 3)</option>
                                  <option value="letters">Letters (a, b, c)</option>
                                  <option value="roman">Roman (i, ii, iii)</option>
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddSubsectionListItem(sec.id, sub.id)}
                                className="px-2 py-1 rounded bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <Plus className="w-3 h-3" /> Add List Item (+)
                              </button>
                            </div>

                            {/* List Items Editor */}
                            <div className="space-y-1.5">
                              {(sub.listItems || []).map((item, itemIdx) => {
                                const itemPrefix = getPrefix(itemIdx, sub.enumeration || 'letters', true);
                                return (
                                  <div key={itemIdx} className="flex items-center gap-1.5">
                                    <span className="w-6 text-[11px] font-mono text-teal-400 font-bold shrink-0 text-right">
                                      {itemPrefix || '•'}
                                    </span>
                                    <input
                                      type="text"
                                      value={item}
                                      onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                      onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                      onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                      onChange={(e) => handleUpdateSubsectionListItem(sec.id, sub.id, itemIdx, e.target.value)}
                                      placeholder="Type list item stipulation or requirement..."
                                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-white outline-none focus:border-teal-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubsectionListItem(sec.id, sub.id, itemIdx)}
                                      className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* If Subsection Type is 'table' */}
                        {subType === 'table' && (
                          <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-300 flex-wrap gap-2">
                              <span className="text-[11px] font-mono text-indigo-400 uppercase">Subsection Table</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleAddSubsectionColumn(sec.id, sub.id)}
                                  className="px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Plus className="w-3 h-3" /> Add Column
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddSubsectionRow(sec.id, sub.id)}
                                  className="px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Plus className="w-3 h-3" /> Add Row
                                </button>
                              </div>
                            </div>

                            {/* Subsection Table Column Headers */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-mono uppercase text-slate-400">
                                Column Headers
                              </label>
                              <div className="flex items-center gap-1.5">
                                {(sub.tableHeaders || ['Specification Item', 'Target / Requirement']).map((hdr, cIdx) => (
                                  <div key={cIdx} className="flex-1 flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={hdr}
                                      onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                      onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                      onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                      onChange={(e) => {
                                        const hdrs = [...(sub.tableHeaders || ['Specification Item', 'Target / Requirement'])];
                                        hdrs[cIdx] = e.target.value;
                                        handleUpdateSubsection(sec.id, sub.id, { tableHeaders: hdrs });
                                      }}
                                      placeholder={`Column ${cIdx + 1}`}
                                      className="w-full px-2 py-0.5 text-xs rounded bg-slate-900 border border-slate-700 text-indigo-200 font-bold outline-none focus:border-indigo-500"
                                    />
                                    {(sub.tableHeaders && sub.tableHeaders.length > 1) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSubsectionColumn(sec.id, sub.id, cIdx)}
                                        className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer"
                                        title={`Delete Column ${cIdx + 1}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Subsection Table Rows */}
                            <div className="space-y-1.5">
                              {(sub.tableRows || []).map((row, rIdx) => {
                                const colCount = (sub.tableHeaders && sub.tableHeaders.length) || 2;
                                return (
                                  <div key={rIdx} className="flex items-center gap-1.5">
                                    {Array.from({ length: colCount }).map((_, cIdx) => (
                                      <input
                                        key={cIdx}
                                        type="text"
                                        value={row[cIdx] || ''}
                                        onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                        onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                        onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                                        onChange={(e) => {
                                          const newRows = (sub.tableRows || []).map((r) => [...r]);
                                          if (!newRows[rIdx]) newRows[rIdx] = [];
                                          newRows[rIdx][cIdx] = e.target.value;
                                          handleUpdateSubsection(sec.id, sub.id, { tableRows: newRows });
                                        }}
                                        placeholder={cIdx === 0 ? 'Item' : 'Value / Spec'}
                                        className="flex-1 px-2 py-0.5 text-xs rounded bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-500"
                                      />
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubsectionRow(sec.id, sub.id, rIdx)}
                                      className="p-1 rounded text-rose-400 hover:bg-rose-950 cursor-pointer"
                                      title="Delete Row"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* If Subsection Type is a Role/Duties type or Skills */}
                        {(subType === 'all_roles' || subType === 'key_roles' || subType === 'normal_roles' || subType === 'skills' || subType === 'duties_list') && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-mono text-slate-400">
                                {subType === 'all_roles' || subType === 'duties_list'
                                  ? 'All Roles Introductory Note'
                                  : subType === 'key_roles'
                                  ? 'Key Roles / KPIs Introductory Note'
                                  : subType === 'normal_roles'
                                  ? 'Normal Roles (Non-Key) Introductory Note'
                                  : 'ATS Key Skills Introductory Note'}
                              </label>
                              <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                                subType === 'key_roles'
                                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                                  : subType === 'skills'
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-800/80'
                                  : subType === 'normal_roles'
                                  ? 'bg-sky-950/60 text-sky-300 border-sky-800/80'
                                  : 'bg-teal-950/60 text-teal-300 border-teal-800/80'
                              }`}>
                                Auto-Linked
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              value={sub.text || ''}
                              onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onKeyUp={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                              onChange={(e) => handleUpdateSubsection(sec.id, sub.id, { text: e.target.value })}
                              placeholder={
                                subType === 'skills'
                                  ? 'Introductory text for ATS Key skills...'
                                  : 'Introductory note for role deliverables...'
                              }
                              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none leading-relaxed font-sans focus:border-teal-500"
                            />
                            <p className="text-[10px] text-slate-400 bg-slate-950/70 px-2 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-teal-400 shrink-0" />
                              <span>
                                {subType === 'all_roles' || subType === 'duties_list'
                                  ? 'Automatically displays all role description deliverables for this role.'
                                  : subType === 'key_roles'
                                  ? 'Automatically displays only designated Key Role deliverables / KPIs.'
                                  : subType === 'normal_roles'
                                  ? 'Automatically displays non-key routine operational duties.'
                                  : 'Automatically displays the ATS Key Skills configured for this role.'}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Single Add Subsection Button under subsections */}
                  <button
                    type="button"
                    onClick={() => handleAddSubsection(sec.id, 'text')}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-700 hover:border-blue-500/80 bg-slate-950/40 hover:bg-slate-900 text-slate-400 hover:text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Add a new subsection clause"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Add Subsection</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Single Add Section Button under the last section */}
            <button
              type="button"
              onClick={() => handleAddSection('text')}
              className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-teal-500/80 bg-slate-800/40 hover:bg-slate-800/80 text-slate-300 hover:text-teal-300 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer group shadow-sm"
              title="Add a new section"
            >
              <Plus className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
              <span>Add Section</span>
            </button>
          </div>

          {/* Signatures & Authorization Blocks Builder */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className={`text-xs font-bold ${colorMap.textAccent} font-mono uppercase tracking-wider flex items-center gap-1.5`}>
                <PenTool className="w-3.5 h-3.5" />
                <span>Signature & Authorization Blocks ({currentSignatures.signatures.length})</span>
              </h4>
              <button
                type="button"
                onClick={handleAddSignature}
                className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3 h-3" /> Add Block
              </button>
            </div>

            <div className="space-y-2.5">
              {currentSignatures.signatures.map((sig, sIdx) => (
                <div key={sig.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                      Signature #{sIdx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSignature(sig.id)}
                      disabled={currentSignatures.signatures.length <= 1}
                      className="p-1 rounded text-rose-400 hover:bg-rose-950 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                      title={currentSignatures.signatures.length <= 1 ? "At least 1 signature block is required" : "Delete signature block"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono text-slate-400 uppercase">
                        Signee / Authority Title
                      </label>
                      <input
                        type="text"
                        value={sig.title}
                        onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onChange={(e) => handleUpdateSignature(sig.id, { title: e.target.value })}
                        placeholder="e.g. Authorized HR / Management Representative"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-blue-500 font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono text-slate-400 uppercase">
                        Date / Line Placeholder Subtitle
                      </label>
                      <input
                        type="text"
                        value={sig.subtitle || ''}
                        onFocus={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onClick={(e) => { lastActiveInputRef.current = e.currentTarget; }}
                        onChange={(e) => handleUpdateSignature(sig.id, { subtitle: e.target.value })}
                        placeholder="Date: ____ / ____ / ________"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Live Paper Document Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 font-mono">
            <span>Live Output Preview</span>
            <span className="text-[10px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800">
              Word (.doc) & Print Preview
            </span>
          </div>

          <div
            className="p-6 rounded-2xl bg-white border border-slate-300 shadow-xl space-y-4 font-sans text-xs leading-relaxed max-h-[65vh] overflow-y-auto"
            style={{ color: textColor }}
          >
            {/* Top Centered Logo (if attached) */}
            {companyLogo && (
              <div className="flex items-center justify-center pb-2 text-center">
                <img
                  src={companyLogo}
                  alt="Company Logo"
                  className="max-h-16 max-w-[200px] object-contain mx-auto"
                />
              </div>
            )}

            {/* Header */}
            <div
              className="text-center pb-3 space-y-1"
              style={{ borderBottom: `2px dashed ${lineColor}` }}
            >
              <div
                className="font-extrabold tracking-wider text-xs uppercase"
                style={{ color: lineColor }}
              >
                {displayCompanyName}
              </div>
              <div
                className="font-bold text-xs uppercase"
                style={{ color: textColor }}
              >
                {documentTitle || 'OFFICIAL DOCUMENT'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Issue Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {/* Document Header Metadata ("Head of the Letter" Left & Right Slots) */}
            {((activeHeaderMeta.leftItems && activeHeaderMeta.leftItems.length > 0) ||
              (activeHeaderMeta.rightItems && activeHeaderMeta.rightItems.length > 0)) && (
              <div className="flex justify-between text-[10px] font-mono text-slate-500 border-b border-slate-200 pb-2 gap-4">
                <div className="space-y-0.5 text-left flex-1">
                  {(activeHeaderMeta.leftItems || []).map((item) => (
                    <div key={item.id} className="leading-tight">
                      {item.label && <span className="font-semibold text-slate-600">{item.label}: </span>}
                      <span className="text-slate-500">{replaceDocumentTags(item.value, mockStaff, displayCompanyName)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-0.5 text-right flex-1">
                  {(activeHeaderMeta.rightItems || []).map((item) => (
                    <div key={item.id} className="leading-tight">
                      {item.label && <span className="font-semibold text-slate-600">{item.label}: </span>}
                      <span className="text-slate-500">{replaceDocumentTags(item.value, mockStaff, displayCompanyName)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rendered Sections */}
            <div className="space-y-4 text-[11px]" style={{ color: textColor }}>
              {sections.map((sec, secIdx) => {
                const prefix = getPrefix(secIdx, sec.enumeration, false);
                const title = prefix + replaceDocumentTags(sec.title, mockStaff, displayCompanyName);

                return (
                  <div key={sec.id} className="space-y-1.5">
                    <div
                      className="font-bold uppercase text-[11px] pb-0.5"
                      style={{
                        color: lineColor,
                        borderBottom: `1px solid ${lineColor}40`,
                      }}
                    >
                      {title}
                    </div>

                    {sec.type === 'text' && (
                      <p className="leading-relaxed text-[10.5px]" style={{ color: textColor }}>
                        {replaceDocumentTags(sec.text || '', mockStaff, displayCompanyName)}
                      </p>
                    )}

                    {(sec.type === 'all_roles' || sec.type === 'duties_list') && (
                      <div className="space-y-1">
                        {sec.text && (
                          <p className="text-[10.5px]" style={{ color: textColor }}>
                            {replaceDocumentTags(sec.text, mockStaff, displayCompanyName)}
                          </p>
                        )}
                        <ul className="list-disc list-inside pl-1 text-[10.5px] space-y-0.5" style={{ color: textColor }}>
                          <li>Lead departmental shift handovers and operational escalations</li>
                          <li>Execute daily workflow management and quality control benchmarks</li>
                          <li>Maintain compliance records and submit operational summaries</li>
                        </ul>
                      </div>
                    )}

                    {sec.type === 'key_roles' && (
                      <div className="space-y-1">
                        {sec.text && (
                          <p className="text-[10.5px]" style={{ color: textColor }}>
                            {replaceDocumentTags(sec.text, mockStaff, displayCompanyName)}
                          </p>
                        )}
                        <div className="p-2 rounded bg-amber-50/80 border border-amber-200 text-[10.5px] space-y-1 text-slate-800">
                          <div className="font-bold text-amber-900 flex items-center gap-1 text-[10px] uppercase font-mono">
                            <span>★ Primary Key Responsibilities & KPIs</span>
                          </div>
                          <ul className="list-disc list-inside pl-1 space-y-0.5">
                            <li><strong>Deliverable 1:</strong> Direct shift oversight and statutory protocol compliance</li>
                            <li><strong>Deliverable 2:</strong> Monthly KPI achievement and operational milestone delivery</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {sec.type === 'normal_roles' && (
                      <div className="space-y-1">
                        {sec.text && (
                          <p className="text-[10.5px]" style={{ color: textColor }}>
                            {replaceDocumentTags(sec.text, mockStaff, displayCompanyName)}
                          </p>
                        )}
                        <ul className="list-disc list-inside pl-1 text-[10.5px] space-y-0.5" style={{ color: textColor }}>
                          <li>Conduct routine daily status checklists and maintenance logging</li>
                          <li>Coordinate standard communication across cross-functional colleagues</li>
                        </ul>
                      </div>
                    )}

                    {sec.type === 'skills' && (
                      <div className="space-y-1.5">
                        {sec.text && (
                          <p className="text-[10.5px]" style={{ color: textColor }}>
                            {replaceDocumentTags(sec.text, mockStaff, displayCompanyName)}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {['Operational Leadership', 'Regulatory Safety Protocols', 'Workflow Optimization', 'Quality Assurance'].map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                              style={{
                                backgroundColor: `${lineColor}12`,
                                borderColor: `${lineColor}40`,
                                color: textColor,
                              }}
                            >
                              🏷️ {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {sec.type === 'list' && (
                      <div className="space-y-1">
                        {sec.heading && (
                          <p className="text-[10.5px] font-semibold" style={{ color: textColor }}>
                            {replaceDocumentTags(sec.heading, mockStaff, displayCompanyName)}
                          </p>
                        )}
                        <ul className="space-y-0.5 pl-1 text-[10.5px]" style={{ color: textColor }}>
                          {(sec.listItems && sec.listItems.length > 0 ? sec.listItems : ['Operational deliverable requirement']).map((item, itemIdx) => {
                            const itemPrefix = getPrefix(itemIdx, sec.enumeration || 'letters', true);
                            return (
                              <li key={itemIdx} className="flex items-start gap-1">
                                <span className="font-bold shrink-0">{itemPrefix || '•'}</span>
                                <span>{replaceDocumentTags(item, mockStaff, displayCompanyName)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {sec.type === 'table' && (
                      <table className="w-full border-collapse text-[10px] my-1">
                        <thead>
                          <tr style={{ backgroundColor: `${lineColor}15` }}>
                            {(sec.tableHeaders || ['Parameter', 'Specification']).map((h, i) => (
                              <th
                                key={i}
                                className="border p-1 text-left font-bold"
                                style={{ borderColor: `${lineColor}40`, color: textColor }}
                              >
                                {replaceDocumentTags(h, mockStaff, displayCompanyName)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(sec.tableRows || []).map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-slate-200">
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="border p-1"
                                  style={{ borderColor: `${lineColor}25`, color: textColor }}
                                >
                                  {replaceDocumentTags(cell, mockStaff, displayCompanyName)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {sec.type === 'jd_targets_table' && (
                      <div className="my-2 space-y-1">
                        <table className="w-full border-collapse text-[9.5px] my-1">
                          <thead>
                            <tr style={{ backgroundColor: `${lineColor}15` }}>
                              {(sec.tableHeaders || ['Job Description / Duty', 'Target / Metric', 'Weight (%)', 'Self Rating', 'Supervisor Rating', 'Remarks']).map((h, i) => (
                                <th
                                  key={i}
                                  className="border p-1 text-left font-bold"
                                  style={{ borderColor: `${lineColor}40`, color: textColor }}
                                >
                                  {replaceDocumentTags(h, mockStaff, displayCompanyName)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let previewItems = [
                                { duty: 'Execute key operational mandates and enforce service SLAs', target: '≥98% quarterly fulfillment', weight: 35, isKey: true },
                                { duty: 'Supervise inventory reconciliation across supply hubs', target: '≤24hr turnaround on variance logs', weight: 25, isKey: true },
                                { duty: 'Maintain daily dispatch tracking logs and records', target: '100% compliant documentation', weight: 20, isKey: false },
                                { duty: 'Conduct weekly safety protocol compliance checks', target: 'Zero critical safety incidents', weight: 20, isKey: false },
                              ];
                              if (sec.dutyFilter === 'key') {
                                previewItems = previewItems.filter((item) => item.isKey);
                              } else if (sec.dutyFilter === 'normal') {
                                previewItems = previewItems.filter((item) => !item.isKey);
                              }
                              if (sec.sortByWeight !== false) {
                                previewItems.sort((a, b) => b.weight - a.weight);
                              }
                              const colCount = (sec.tableHeaders && sec.tableHeaders.length) || 6;
                              return (
                                <>
                                  {previewItems.map((item, rowIdx) => (
                                    <tr key={rowIdx} className="border-b border-slate-200">
                                      <td className="border p-1 font-semibold" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                        {item.duty}
                                      </td>
                                      <td className="border p-1 font-mono" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                        {item.target}
                                      </td>
                                      <td className="border p-1 text-center font-bold" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                        {item.weight}%
                                      </td>
                                      {Array.from({ length: Math.max(0, colCount - 3) }).map((_, cIdx) => (
                                        <td key={cIdx} className="border p-1 text-center text-slate-400" style={{ borderColor: `${lineColor}25` }}>
                                          [ &nbsp; ]
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                  {(sec.tableRows || []).map((row, rIdx) => (
                                    <tr key={`custom-${rIdx}`} className="border-b border-slate-200">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="border p-1" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                          {replaceDocumentTags(cell, mockStaff, displayCompanyName)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Subsections */}
                    {(sec.subsections || []).map((sub, subIdx) => {
                      const subPrefix = getPrefix(subIdx, sub.enumeration, true);
                      const subType = sub.type || 'text';

                      return (
                        <div key={sub.id} className="pl-3 border-l-2 border-slate-200 space-y-1 mt-1.5">
                          <div className="font-bold text-[10.5px]" style={{ color: textColor }}>
                            {subPrefix}{replaceDocumentTags(sub.title, mockStaff, displayCompanyName)}
                          </div>

                          {subType === 'text' && (
                            <p className="text-[10px] opacity-80" style={{ color: textColor }}>
                              {replaceDocumentTags(sub.text || '', mockStaff, displayCompanyName)}
                            </p>
                          )}

                          {subType === 'list' && (
                            <div className="space-y-1">
                              {sub.heading && (
                                <p className="text-[10px] font-semibold" style={{ color: textColor }}>
                                  {replaceDocumentTags(sub.heading, mockStaff, displayCompanyName)}
                                </p>
                              )}
                              <ul className="space-y-0.5 pl-1 text-[10px]" style={{ color: textColor }}>
                                {(sub.listItems && sub.listItems.length > 0 ? sub.listItems : ['Operational deliverable requirement']).map((item, itemIdx) => {
                                  const itemPrefix = getPrefix(itemIdx, sub.enumeration || 'letters', true);
                                  return (
                                    <li key={itemIdx} className="flex items-start gap-1">
                                      <span className="font-bold shrink-0">{itemPrefix || '•'}</span>
                                      <span>{replaceDocumentTags(item, mockStaff, displayCompanyName)}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {subType === 'table' && (
                            <table className="w-full border-collapse text-[9.5px] my-1">
                              <thead>
                                <tr style={{ backgroundColor: `${lineColor}15` }}>
                                  {(sub.tableHeaders || ['Specification Item', 'Target / Requirement']).map((h, i) => (
                                    <th
                                      key={i}
                                      className="border p-1 text-left font-bold"
                                      style={{ borderColor: `${lineColor}40`, color: textColor }}
                                    >
                                      {replaceDocumentTags(h, mockStaff, displayCompanyName)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(sub.tableRows || [['Delivery Timeline', 'Standard Operating Cycle']]).map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-slate-200">
                                    {row.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="border p-1"
                                        style={{ borderColor: `${lineColor}25`, color: textColor }}
                                      >
                                        {replaceDocumentTags(cell, mockStaff, displayCompanyName)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {subType === 'jd_targets_table' && (
                            <table className="w-full border-collapse text-[9.5px] my-1">
                              <thead>
                                <tr style={{ backgroundColor: `${lineColor}15` }}>
                                  {(sub.tableHeaders || ['Job Description / Duty', 'Target / Metric', 'Weight (%)', 'Self Rating', 'Supervisor Rating', 'Remarks']).map((h, i) => (
                                    <th
                                      key={i}
                                      className="border p-1 text-left font-bold"
                                      style={{ borderColor: `${lineColor}40`, color: textColor }}
                                    >
                                      {replaceDocumentTags(h, mockStaff, displayCompanyName)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  let previewItems = [
                                    { duty: 'Execute key operational mandates and enforce service SLAs', target: '≥98% quarterly fulfillment', weight: 35, isKey: true },
                                    { duty: 'Supervise inventory reconciliation across supply hubs', target: '≤24hr turnaround on variance logs', weight: 25, isKey: true },
                                    { duty: 'Maintain daily dispatch tracking logs and records', target: '100% compliant documentation', weight: 20, isKey: false },
                                  ];
                                  if (sub.dutyFilter === 'key') {
                                    previewItems = previewItems.filter((item) => item.isKey);
                                  } else if (sub.dutyFilter === 'normal') {
                                    previewItems = previewItems.filter((item) => !item.isKey);
                                  }
                                  if (sub.sortByWeight !== false) {
                                    previewItems.sort((a, b) => b.weight - a.weight);
                                  }
                                  const colCount = (sub.tableHeaders && sub.tableHeaders.length) || 6;
                                  return (
                                    <>
                                      {previewItems.map((item, rowIdx) => (
                                        <tr key={rowIdx} className="border-b border-slate-200">
                                          <td className="border p-1 font-semibold" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                            {item.duty}
                                          </td>
                                          <td className="border p-1 font-mono" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                            {item.target}
                                          </td>
                                          <td className="border p-1 text-center font-bold" style={{ borderColor: `${lineColor}25`, color: textColor }}>
                                            {item.weight}%
                                          </td>
                                          {Array.from({ length: Math.max(0, colCount - 3) }).map((_, cIdx) => (
                                            <td key={cIdx} className="border p-1 text-center text-slate-400" style={{ borderColor: `${lineColor}25` }}>
                                              [ &nbsp; ]
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </>
                                  );
                                })()}
                              </tbody>
                            </table>
                          )}

                          {(subType === 'all_roles' || subType === 'duties_list') && (
                            <div className="space-y-1">
                              {sub.text && (
                                <p className="text-[10px]" style={{ color: textColor }}>
                                  {replaceDocumentTags(sub.text, mockStaff, displayCompanyName)}
                                </p>
                              )}
                              <ul className="list-disc list-inside pl-1 text-[10px] space-y-0.5" style={{ color: textColor }}>
                                <li>Execute core role directives and departmental workflows</li>
                                <li>Ensure compliance with operational quality benchmarks</li>
                              </ul>
                            </div>
                          )}

                          {subType === 'key_roles' && (
                            <div className="space-y-1">
                              {sub.text && (
                                <p className="text-[10px]" style={{ color: textColor }}>
                                  {replaceDocumentTags(sub.text, mockStaff, displayCompanyName)}
                                </p>
                              )}
                              <div className="p-1.5 rounded bg-amber-50/70 border border-amber-200 text-[9.5px] space-y-0.5 text-slate-800">
                                <div className="font-bold text-amber-900 text-[9px] uppercase font-mono">
                                  ★ Key Role KPIs
                                </div>
                                <ul className="list-disc list-inside pl-0.5 space-y-0.5">
                                  <li>Direct shift oversight & critical escalation SLA</li>
                                  <li>Statutory regulatory safety compliance</li>
                                </ul>
                              </div>
                            </div>
                          )}

                          {subType === 'normal_roles' && (
                            <div className="space-y-1">
                              {sub.text && (
                                <p className="text-[10px]" style={{ color: textColor }}>
                                  {replaceDocumentTags(sub.text, mockStaff, displayCompanyName)}
                                </p>
                              )}
                              <ul className="list-disc list-inside pl-1 text-[10px] space-y-0.5" style={{ color: textColor }}>
                                <li>Routine daily status checklists and operational logging</li>
                                <li>Cross-departmental standard communication</li>
                              </ul>
                            </div>
                          )}

                          {subType === 'skills' && (
                            <div className="space-y-1">
                              {sub.text && (
                                <p className="text-[10px]" style={{ color: textColor }}>
                                  {replaceDocumentTags(sub.text, mockStaff, displayCompanyName)}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {['Operational Leadership', 'Safety Protocols', 'Quality Assurance'].map((skill, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                                    style={{
                                      backgroundColor: `${lineColor}12`,
                                      borderColor: `${lineColor}40`,
                                      color: textColor,
                                    }}
                                  >
                                    🏷️ {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Signatures (2D Grid: 2 Columns, N Rows) */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-slate-300 text-[10px]">
              {(currentSignatures.signatures && currentSignatures.signatures.length > 0
                ? currentSignatures.signatures
                : [
                    { id: 'sig-1', title: hrSigLabel, subtitle: 'Date: ____ / ____ / ________' },
                    { id: 'sig-2', title: empSigLabel, subtitle: 'Date: ____ / ____ / ________' },
                  ]
              ).map((sig, sIdx) => (
                <div key={sig.id || sIdx} className="space-y-1">
                  <div
                    className="pt-1 font-bold"
                    style={{ borderTop: `1.5px solid ${lineColor}`, color: textColor }}
                  >
                    {replaceDocumentTags(sig.title, mockStaff, displayCompanyName)}
                  </div>
                  <div className="text-slate-500 font-mono text-[9px]">
                    {sig.subtitle ? replaceDocumentTags(sig.subtitle, mockStaff, displayCompanyName) : 'Date: ____ / ____ / ________'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Bottom Actions */}
      <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-800 flex-wrap">
        <button
          type="button"
          onClick={onResetDefault}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset Default Template</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className={`px-5 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${colorMap.btnPrimary}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save & Apply Format</span>
          </button>
        </div>
      </div>
    </div>
  );
};
