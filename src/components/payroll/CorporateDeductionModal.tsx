import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  TrendingDown,
  Calculator,
  Code2,
  Building2,
  Check,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Tag,
  DollarSign,
  Percent,
  ChevronDown,
  Scale,
  Users,
  Briefcase,
  Layers,
  Trash2,
  Filter,
  Sliders,
  Edit2,
  Clock,
  Calendar,
  UserCheck,
} from 'lucide-react';
import {
  PayrollConfig,
  PayrollDeduction,
  DynamicConditionRule,
  DeductionRuleSet,
  DepartmentInfo,
  DynamicShift,
  StaffMember,
  AppSettings,
} from '../../types';
import { evaluateDeductionFormula } from '../../utils/payrollUtils';
import { getCleanDepartments } from '../../utils/departmentUtils';
import { loadCompanyData, STORAGE_KEYS } from '../../utils/companyStorage';

interface CorporateDeductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: PayrollConfig;
  currencySymbol?: string;
  departments?: string[];
  staffList?: StaffMember[];
  companyDepartments?: DepartmentInfo[];
  existingShifts?: DynamicShift[];
  companyName?: string;
  editingDeduction: PayrollDeduction | null;
  onSave: (deduction: Omit<PayrollDeduction, 'id'>) => void;
}

interface FormulaTag {
  tag: string;
  label: string;
  description: string;
  sampleValue: string;
  category: 'core' | 'rates' | 'time';
}

const FORMULA_TAGS: FormulaTag[] = [
  {
    tag: '{base_salary}',
    label: 'Base Salary',
    description: "Employee's contracted monthly / cycle base salary",
    sampleValue: '$3,500.00',
    category: 'core',
  },
  {
    tag: '{net_disbursal}',
    label: 'Net Disbursal',
    description: 'Estimated net payout before this specific deduction',
    sampleValue: '$2,975.00',
    category: 'core',
  },
  {
    tag: '{gross_salary}',
    label: 'Gross Salary',
    description: 'Base pay plus standard non-taxed allowances',
    sampleValue: '$3,750.00',
    category: 'core',
  },
  {
    tag: '{daily_rate}',
    label: 'Daily Rate',
    description: 'Calculated pro-rated base earnings per day',
    sampleValue: '$116.67',
    category: 'rates',
  },
  {
    tag: '{hourly_rate}',
    label: 'Hourly Rate',
    description: 'Calculated standard working hour rate',
    sampleValue: '$14.58',
    category: 'rates',
  },
  {
    tag: '{days_in_month}',
    label: 'Days in Month',
    description: 'Exact calendar days of current month (28-31)',
    sampleValue: '31',
    category: 'time',
  },
  {
    tag: '{attendance_days}',
    label: 'Attendance Days',
    description: 'Number of active days recorded on duty',
    sampleValue: '22',
    category: 'time',
  },
  {
    tag: '{overtime_hours}',
    label: 'Overtime Hours',
    description: 'Accumulated overtime hours logged this cycle',
    sampleValue: '4.5',
    category: 'time',
  },
  {
    tag: '{late_occurrences}',
    label: 'Late Occurrences',
    description: 'Number of unexcused late arrivals recorded',
    sampleValue: '2',
    category: 'time',
  },
];

const CORPORATE_PRESETS = [
  {
    title: '8% Pension + $15 Admin Fee',
    formula: '({base_salary} * 0.08) + 15',
    desc: 'Statutory 8% retirement fund with fixed administration processing fee',
  },
  {
    title: '12% Graduated PAYE Tax',
    formula: '{base_salary} * 0.12',
    desc: 'Direct statutory income withholding calculation on base earnings',
  },
  {
    title: '5% Health Fund on Gross',
    formula: '{gross_salary} * 0.05',
    desc: 'Applies national healthcare contribution calculated on gross remuneration',
  },
  {
    title: '1 Day Statutory Contribution',
    formula: '({base_salary} / {days_in_month}) * 1',
    desc: 'Deducts exactly 1 working day wage for statutory social levy',
  },
  {
    title: '4 Hours Pay Minimum Levy',
    formula: '{hourly_rate} * 4',
    desc: 'Calculates corporate levy equivalent to 4 standard work hours',
  },
];

const EMPLOYEE_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Trainee'];

export const CorporateDeductionModal: React.FC<CorporateDeductionModalProps> = ({
  isOpen,
  onClose,
  config,
  currencySymbol: customCurrencySymbol,
  departments = [],
  staffList = [],
  companyDepartments = [],
  existingShifts = [],
  companyName = '',
  editingDeduction,
  onSave,
}) => {
  const currencySymbol = customCurrencySymbol || config?.currencySymbol || '$';

  // Load company departments (with their configured roles)
  const allCompanyDepartments: DepartmentInfo[] = useMemo(() => {
    if (companyDepartments && companyDepartments.length > 0) return companyDepartments;
    try {
      const loaded = getCleanDepartments(companyName);
      if (Array.isArray(loaded) && loaded.length > 0) return loaded;
    } catch (e) {}
    return [];
  }, [companyDepartments, companyName]);

  // Load company shifts
  const allCompanyShifts: Array<{ id: string; name: string }> = useMemo(() => {
    if (existingShifts && existingShifts.length > 0) {
      return existingShifts.map((s) => ({ id: s.id, name: s.name }));
    }
    try {
      const loadedSettings = loadCompanyData<AppSettings>(STORAGE_KEYS.SETTINGS, companyName, {} as any);
      if (loadedSettings?.shifts && loadedSettings.shifts.length > 0) {
        return loadedSettings.shifts.map((s) => ({ id: s.id, name: s.name }));
      }
    } catch (e) {}

    // Collect from staffList if any
    if (staffList && staffList.length > 0) {
      const staffShifts = Array.from(new Set(staffList.map((s) => s.shiftSchedule).filter(Boolean))) as string[];
      if (staffShifts.length > 0) {
        return staffShifts.map((s, idx) => ({ id: `shift-${idx}`, name: s }));
      }
    }

    return [
      { id: '1', name: 'Morning Shift' },
      { id: '2', name: 'Afternoon Shift' },
      { id: '3', name: 'Night Shift' },
      { id: '4', name: 'N/A' },
    ];
  }, [existingShifts, companyName, staffList]);

  // Helper to retrieve roles for a given department
  const getDepartmentRoles = (deptName: string): string[] => {
    if (!deptName || deptName === 'All') {
      const allRoles = new Set<string>();
      allCompanyDepartments.forEach((d) => {
        (d.roles || []).forEach((r) => {
          if (r.title && r.title.trim()) allRoles.add(r.title.trim());
        });
      });
      staffList.forEach((s) => {
        if (s.role && s.role.trim()) allRoles.add(s.role.trim());
      });
      return Array.from(allRoles);
    }

    const roleSet = new Set<string>();
    const foundDept = allCompanyDepartments.find(
      (d) => d.name.trim().toLowerCase() === deptName.trim().toLowerCase()
    );
    if (foundDept && foundDept.roles) {
      foundDept.roles.forEach((r) => {
        if (r.title && r.title.trim()) roleSet.add(r.title.trim());
      });
    }
    if (staffList && staffList.length > 0) {
      staffList
        .filter((s) => s.department && s.department.trim().toLowerCase() === deptName.trim().toLowerCase())
        .forEach((s) => {
          if (s.role && s.role.trim()) roleSet.add(s.role.trim());
        });
    }
    return Array.from(roleSet);
  };

  // Existing deductions in company to enforce unique priority weights
  const allCorporateDeductions = useMemo(() => {
    return config?.corporateDeductions || config?.deductions || [];
  }, [config]);

  // Set of weights already used by other corporate deductions
  const usedWeights = useMemo(() => {
    const set = new Set<number>();
    allCorporateDeductions.forEach((d) => {
      if (editingDeduction && d.id === editingDeduction.id) return;
      if (typeof d.weight === 'number' && d.weight >= 1 && d.weight <= 100) {
        set.add(d.weight);
      }
    });
    return set;
  }, [allCorporateDeductions, editingDeduction]);

  // Helper to get next highest available weight from 100 down to 1
  const getNextAvailableWeight = () => {
    for (let w = 100; w >= 1; w--) {
      if (!usedWeights.has(w)) return w;
    }
    return 1;
  };

  const [name, setName] = useState(editingDeduction?.name || '');
  const [type, setType] = useState<'percentage' | 'fixed' | 'formula'>(
    editingDeduction?.type || (editingDeduction?.formula ? 'formula' : 'percentage')
  );
  const [value, setValue] = useState<number>(editingDeduction?.value || 5);
  const [formula, setFormula] = useState<string>(
    editingDeduction?.formula || '({base_salary} * 0.08) + 15'
  );
  const [description, setDescription] = useState(editingDeduction?.description || '');
  const [isEnabled, setIsEnabled] = useState<boolean>(
    editingDeduction ? editingDeduction.isEnabled : true
  );

  // Priority Weight (1-100, compulsory, unique)
  const [weight, setWeight] = useState<number>(() => {
    if (editingDeduction?.weight && editingDeduction.weight >= 1 && editingDeduction.weight <= 100) {
      return editingDeduction.weight;
    }
    return getNextAvailableWeight();
  });

  // Calculation Basis: 'base' | 'net'
  const [calculationBasis, setCalculationBasis] = useState<'base' | 'net'>(
    editingDeduction?.calculationBasis || 'base'
  );

  // Formula Editor Panel Toggle
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(
    Boolean(editingDeduction?.type === 'formula' || editingDeduction?.formula)
  );

  // Applicable Conditional Mapping rules state
  const [rules, setRules] = useState<DeductionRuleSet[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);

  // Sub-modal temporary form state for the rule being configured:
  const [ruleName, setRuleName] = useState<string>('Rule 1');
  const [ruleDepartments, setRuleDepartments] = useState<string[]>(['All']);
  const [ruleEmployeeTypes, setRuleEmployeeTypes] = useState<string[]>(['All']);
  const [rulePayGrades, setRulePayGrades] = useState<string[]>(['All']);
  const [ruleGrossSalaryCondition, setRuleGrossSalaryCondition] = useState<{
    enabled: boolean;
    operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
    value: number;
  }>({
    enabled: false,
    operator: '>=',
    value: 3000,
  });
  const [ruleCustomConditions, setRuleCustomConditions] = useState<DynamicConditionRule[]>([]);
  const [isRuleDeptDropdownOpen, setIsRuleDeptDropdownOpen] = useState<boolean>(false);
  const ruleDeptDropdownRef = useRef<HTMLDivElement>(null);

  // Sandbox simulation state
  const [testSalary, setTestSalary] = useState<number>(3500);
  const [testDaysInMonth, setTestDaysInMonth] = useState<number>(30);
  const [selectedTagCategory, setSelectedTagCategory] = useState<'all' | 'core' | 'rates' | 'time'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Available pay grades from config or standard fallback
  const availablePayGrades = useMemo(() => {
    if (config?.payGrades && config.payGrades.length > 0) {
      return config.payGrades.map((g) => g.name);
    }
    return ['Grade L1', 'Grade L2', 'Grade L3', 'Grade L4', 'Grade L5', 'Executive'];
  }, [config]);

  // Sync state when editingDeduction or isOpen changes
  useEffect(() => {
    if (editingDeduction) {
      setName(editingDeduction.name);
      setType(editingDeduction.type || (editingDeduction.formula ? 'formula' : 'percentage'));
      setValue(editingDeduction.value);
      setFormula(editingDeduction.formula || '({base_salary} * 0.08) + 15');
      setDescription(editingDeduction.description || '');
      setIsEnabled(editingDeduction.isEnabled !== false);
      setIsEditorOpen(Boolean(editingDeduction.type === 'formula' || editingDeduction.formula));

      // Weight
      if (editingDeduction.weight && editingDeduction.weight >= 1 && editingDeduction.weight <= 100) {
        setWeight(editingDeduction.weight);
      } else {
        setWeight(getNextAvailableWeight());
      }

      // Calculation Basis
      setCalculationBasis(editingDeduction.calculationBasis || 'base');

      // Rules configuration
      if (editingDeduction.rules && editingDeduction.rules.length > 0) {
        setRules(editingDeduction.rules);
      } else if (
        (editingDeduction.applicableDepartments && !editingDeduction.applicableDepartments.includes('All')) ||
        (editingDeduction.applicableEmployeeTypes && !editingDeduction.applicableEmployeeTypes.includes('All')) ||
        (editingDeduction.applicablePayGrades && !editingDeduction.applicablePayGrades.includes('All')) ||
        editingDeduction.grossSalaryCondition?.enabled ||
        (editingDeduction.customConditions && editingDeduction.customConditions.length > 0)
      ) {
        setRules([
          {
            id: 'rule-1',
            name: 'Rule 1',
            applicableDepartments: editingDeduction.applicableDepartments || ['All'],
            applicableEmployeeTypes: editingDeduction.applicableEmployeeTypes || ['All'],
            applicablePayGrades: editingDeduction.applicablePayGrades || ['All'],
            grossSalaryCondition: editingDeduction.grossSalaryCondition || { enabled: false, operator: '>=', value: 3000 },
            customConditions: editingDeduction.customConditions || [],
          },
        ]);
      } else {
        setRules([]);
      }
    } else {
      setName('');
      setType('percentage');
      setValue(5);
      setFormula('({base_salary} * 0.08) + 15');
      setDescription('');
      setIsEnabled(true);
      setIsEditorOpen(false);
      setWeight(getNextAvailableWeight());
      setCalculationBasis('base');
      setRules([]);
    }
  }, [editingDeduction, isOpen]);

  // Net Disbursal check in formula
  const isNetDisbursalInFormula = useMemo(() => {
    if (!formula) return false;
    const lower = formula.toLowerCase();
    return lower.includes('net_disbursal') || lower.includes('net disbursal');
  }, [formula]);

  // Toggle disability rule:
  // If formula contains net_disbursal -> automatically Net and toggle disabled.
  // Once net_disbursal is removed, it becomes enabled IF AND ONLY IF calculation type is not formula.
  const isToggleDisabled = isNetDisbursalInFormula || type === 'formula';

  // Enforce Net / Base logic
  useEffect(() => {
    if (isNetDisbursalInFormula) {
      setCalculationBasis('net');
    } else if (type === 'formula') {
      setCalculationBasis('base');
    }
  }, [isNetDisbursalInFormula, type]);

  // Real-time evaluation of current formula
  const evaluationResult = useMemo(() => {
    const dailyRate = testDaysInMonth > 0 ? testSalary / testDaysInMonth : 0;
    const hourlyRate = dailyRate / 8;
    return evaluateDeductionFormula(formula, {
      baseSalary: testSalary,
      netDisbursal: Math.max(0, testSalary * 0.82),
      grossSalary: testSalary + 250,
      dailyRate,
      hourlyRate,
      daysInMonth: testDaysInMonth,
      attendanceDays: 22,
      overtimeHours: 4.5,
      lateOccurrences: 2,
    });
  }, [formula, testSalary, testDaysInMonth]);

  const handleInsertTag = (tag: string) => {
    if (!textareaRef.current) {
      setFormula((prev) => `${prev} ${tag}`);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const nextFormula = formula.substring(0, start) + tag + formula.substring(end);
    setFormula(nextFormula);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + tag.length, start + tag.length);
      }
    }, 0);
  };

  const handleInsertOperator = (op: string) => {
    handleInsertTag(` ${op} `);
  };

  const availableDepartments = useMemo(() => {
    const filtered = departments.filter((d) => d !== 'All');
    return filtered.length > 0
      ? filtered
      : ['Engineering', 'Sales', 'Marketing', 'Customer Support', 'Operations', 'Finance', 'Human Resources'];
  }, [departments]);

  // Open Rule Modal to create a new rule
  const handleOpenCreateRule = () => {
    setEditingRuleIndex(null);
    setRuleName(`Rule ${rules.length + 1}`);
    setRuleDepartments(['All']);
    setRuleEmployeeTypes(['All']);
    setRulePayGrades(['All']);
    setRuleGrossSalaryCondition({ enabled: false, operator: '>=', value: 3000 });
    setRuleCustomConditions([]);
    setIsRuleDeptDropdownOpen(false);
    setIsRuleModalOpen(true);
  };

  // Open Rule Modal to edit existing rule
  const handleOpenEditRule = (idx: number) => {
    const targetRule = rules[idx];
    if (!targetRule) return;
    setEditingRuleIndex(idx);
    setRuleName(targetRule.name || `Rule ${idx + 1}`);
    setRuleDepartments(targetRule.applicableDepartments && targetRule.applicableDepartments.length > 0 ? targetRule.applicableDepartments : ['All']);
    setRuleEmployeeTypes(targetRule.applicableEmployeeTypes && targetRule.applicableEmployeeTypes.length > 0 ? targetRule.applicableEmployeeTypes : ['All']);
    setRulePayGrades(targetRule.applicablePayGrades && targetRule.applicablePayGrades.length > 0 ? targetRule.applicablePayGrades : ['All']);
    setRuleGrossSalaryCondition(targetRule.grossSalaryCondition || { enabled: false, operator: '>=', value: 3000 });
    setRuleCustomConditions(targetRule.customConditions ? [...targetRule.customConditions] : []);
    setIsRuleDeptDropdownOpen(false);
    setIsRuleModalOpen(true);
  };

  // Delete rule
  const handleDeleteRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save rule inside sub-modal
  const handleSaveCurrentRule = () => {
    const newRule: DeductionRuleSet = {
      id: editingRuleIndex !== null && rules[editingRuleIndex]?.id ? rules[editingRuleIndex].id : `rule-${Date.now()}`,
      name: ruleName.trim() || `Rule ${(editingRuleIndex !== null ? editingRuleIndex : rules.length) + 1}`,
      applicableDepartments: ruleDepartments.length > 0 ? ruleDepartments : ['All'],
      applicableEmployeeTypes: ruleEmployeeTypes.length > 0 ? ruleEmployeeTypes : ['All'],
      applicablePayGrades: rulePayGrades.length > 0 ? rulePayGrades : ['All'],
      grossSalaryCondition: ruleGrossSalaryCondition,
      customConditions: ruleCustomConditions,
    };

    if (editingRuleIndex !== null) {
      setRules((prev) => {
        const next = [...prev];
        next[editingRuleIndex] = newRule;
        return next;
      });
    } else {
      setRules((prev) => [...prev, newRule]);
    }
    setIsRuleModalOpen(false);
  };

  // Rule sub-modal Department helpers
  const selectedRuleSpecificDepts = useMemo(() => {
    return ruleDepartments.filter((d) => d !== 'All');
  }, [ruleDepartments]);

  const handleAddRuleDepartment = (deptName: string) => {
    const current = ruleDepartments.filter((d) => d !== 'All');
    if (!current.includes(deptName)) {
      setRuleDepartments([...current, deptName]);
    }
  };

  const handleRemoveRuleDepartment = (deptName: string) => {
    const updated = ruleDepartments.filter((d) => d !== deptName && d !== 'All');
    setRuleDepartments(updated.length === 0 ? ['All'] : updated);
  };

  // Rule sub-modal Employee type helper
  const handleToggleRuleEmployeeType = (cat: string) => {
    if (cat === 'All') {
      setRuleEmployeeTypes(['All']);
      return;
    }
    const current = ruleEmployeeTypes.filter((t) => t !== 'All');
    if (current.includes(cat)) {
      const updated = current.filter((t) => t !== cat);
      setRuleEmployeeTypes(updated.length === 0 ? ['All'] : updated);
    } else {
      setRuleEmployeeTypes([...current, cat]);
    }
  };

  // Rule sub-modal Pay grade helper
  const handleToggleRulePayGrade = (grade: string) => {
    if (grade === 'All') {
      setRulePayGrades(['All']);
      return;
    }
    const current = rulePayGrades.filter((g) => g !== 'All');
    if (current.includes(grade)) {
      const updated = current.filter((g) => g !== grade);
      setRulePayGrades(updated.length === 0 ? ['All'] : updated);
    } else {
      setRulePayGrades([...current, grade]);
    }
  };

  // Standard custom attributes metadata
  const CUSTOM_FIELD_OPTIONS = [
    {
      field: 'role',
      label: 'Role / Job Title',
      badge: 'Dynamic Dept & Role',
      icon: Briefcase,
      defaultOperator: 'in',
    },
    {
      field: 'shiftSchedule',
      label: 'Shift Schedule',
      badge: 'Company Shifts',
      icon: Clock,
      defaultOperator: 'in',
    },
    {
      field: 'payFrequency',
      label: 'Pay Frequency',
      badge: 'Monthly / Bi-Weekly / Weekly',
      icon: Calendar,
      defaultOperator: 'in',
    },
    {
      field: 'status',
      label: 'Staff Status',
      badge: 'Active / Probation / Leave',
      icon: UserCheck,
      defaultOperator: 'in',
    },
    {
      field: 'estimatedMonthlySalary',
      label: 'Base Salary',
      badge: 'Numeric Comparison',
      icon: DollarSign,
      defaultOperator: '>=',
    },
    {
      field: 'custom',
      label: 'Custom Attribute',
      badge: 'Key-Value Filter',
      icon: Tag,
      defaultOperator: '==',
    },
  ];

  // Set of currently used standard fields to prevent conflicts
  const usedConditionFields = useMemo(() => {
    return new Set(ruleCustomConditions.filter((c) => c.field !== 'custom').map((c) => c.field));
  }, [ruleCustomConditions]);

  const [isAddConditionMenuOpen, setIsAddConditionMenuOpen] = useState<boolean>(false);
  const addConditionMenuRef = useRef<HTMLDivElement>(null);

  // Close Add Condition menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addConditionMenuRef.current && !addConditionMenuRef.current.contains(event.target as Node)) {
        setIsAddConditionMenuOpen(false);
      }
    };
    if (isAddConditionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddConditionMenuOpen]);

  // Synchronize Role condition's departmentScope with Section 1's department
  useEffect(() => {
    const specificDepts = ruleDepartments.filter((d) => d !== 'All');
    if (specificDepts.length > 0) {
      setRuleCustomConditions((prev) =>
        prev.map((c) => {
          if (c.field === 'role') {
            // If departmentScope is not set or not in currently selected departments
            if (!c.departmentScope || !specificDepts.includes(c.departmentScope)) {
              return {
                ...c,
                departmentScope: specificDepts[0],
                values: [],
                value: '',
              };
            }
          }
          return c;
        })
      );
    }
  }, [ruleDepartments]);

  // Rule sub-modal Custom dynamic conditions helpers
  const handleAddNewConditionField = (fieldType: string) => {
    if (usedConditionFields.has(fieldType) && fieldType !== 'custom') {
      return;
    }

    let defaultDeptScope = '';
    const specificDepts = ruleDepartments.filter((d) => d !== 'All');
    if (specificDepts.length > 0) {
      defaultDeptScope = specificDepts[0];
    } else if (departments.length > 0) {
      defaultDeptScope = departments[0];
    } else if (allCompanyDepartments.length > 0) {
      defaultDeptScope = allCompanyDepartments[0].name;
    } else {
      defaultDeptScope = 'Engineering';
    }

    let newCond: DynamicConditionRule;

    if (fieldType === 'role') {
      newCond = {
        id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: 'role',
        operator: 'in',
        departmentScope: defaultDeptScope,
        values: [],
        value: '',
      };
    } else if (fieldType === 'shiftSchedule') {
      newCond = {
        id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: 'shiftSchedule',
        operator: 'in',
        values: allCompanyShifts.length > 0 ? [allCompanyShifts[0].name] : ['Morning Shift'],
        value: allCompanyShifts.length > 0 ? allCompanyShifts[0].name : 'Morning Shift',
      };
    } else if (fieldType === 'payFrequency') {
      newCond = {
        id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: 'payFrequency',
        operator: 'in',
        values: ['Monthly'],
        value: 'Monthly',
      };
    } else if (fieldType === 'status') {
      newCond = {
        id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: 'status',
        operator: 'in',
        values: ['Active'],
        value: 'Active',
      };
    } else if (fieldType === 'estimatedMonthlySalary') {
      newCond = {
        id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: 'estimatedMonthlySalary',
        operator: '>=',
        value: 3000,
        values: [],
      };
    } else {
      newCond = {
        id: `cond-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        field: 'custom',
        operator: '==',
        customKey: '',
        value: '',
        values: [],
      };
    }

    setRuleCustomConditions((prev) => [...prev, newCond]);
    setIsAddConditionMenuOpen(false);
  };

  const handleChangeConditionField = (condId: string, newField: string) => {
    const specificDepts = ruleDepartments.filter((d) => d !== 'All');
    const defaultDept = specificDepts.length > 0 ? specificDepts[0] : (departments[0] || 'Engineering');

    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        if (newField === 'role') {
          return {
            ...c,
            field: 'role',
            operator: 'in',
            departmentScope: defaultDept,
            values: [],
            value: '',
          };
        } else if (newField === 'shiftSchedule') {
          return {
            ...c,
            field: 'shiftSchedule',
            operator: 'in',
            values: allCompanyShifts.length > 0 ? [allCompanyShifts[0].name] : ['Morning Shift'],
            value: allCompanyShifts.length > 0 ? allCompanyShifts[0].name : 'Morning Shift',
          };
        } else if (newField === 'payFrequency') {
          return {
            ...c,
            field: 'payFrequency',
            operator: 'in',
            values: ['Monthly'],
            value: 'Monthly',
          };
        } else if (newField === 'status') {
          return {
            ...c,
            field: 'status',
            operator: 'in',
            values: ['Active'],
            value: 'Active',
          };
        } else if (newField === 'estimatedMonthlySalary') {
          return {
            ...c,
            field: 'estimatedMonthlySalary',
            operator: '>=',
            value: 3000,
            values: [],
          };
        } else {
          return {
            ...c,
            field: 'custom',
            operator: '==',
            customKey: '',
            value: '',
            values: [],
          };
        }
      })
    );
  };

  const handleUpdateRuleCondition = (id: string, updates: Partial<DynamicConditionRule>) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleRemoveRuleCondition = (id: string) => {
    setRuleCustomConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // Role multi-selection helpers
  const handleToggleRole = (condId: string, roleTitle: string) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        const currentVals = c.values || (typeof c.value === 'string' && c.value ? c.value.split(',').map((s) => s.trim()) : []);
        const exists = currentVals.includes(roleTitle);
        const updated = exists ? currentVals.filter((r) => r !== roleTitle) : [...currentVals, roleTitle];
        return {
          ...c,
          values: updated,
          value: updated.join(', '),
        };
      })
    );
  };

  const handleSelectAllRoles = (condId: string, roles: string[]) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        return {
          ...c,
          values: [...roles],
          value: roles.join(', '),
        };
      })
    );
  };

  const handleClearRoles = (condId: string) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        return {
          ...c,
          values: [],
          value: '',
        };
      })
    );
  };

  // Shift multi-selection helpers
  const handleToggleShift = (condId: string, shiftName: string) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        const currentVals = c.values || (typeof c.value === 'string' && c.value ? c.value.split(',').map((s) => s.trim()) : []);
        const exists = currentVals.includes(shiftName);
        const updated = exists ? currentVals.filter((s) => s !== shiftName) : [...currentVals, shiftName];
        return {
          ...c,
          values: updated,
          value: updated.join(', '),
        };
      })
    );
  };

  const handleSelectAllShifts = (condId: string, shifts: string[]) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        return {
          ...c,
          values: [...shifts],
          value: shifts.join(', '),
        };
      })
    );
  };

  const handleClearShifts = (condId: string) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        return {
          ...c,
          values: [],
          value: '',
        };
      })
    );
  };

  // Pay Frequency multi-selection helper
  const handleToggleFrequency = (condId: string, freq: string) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        const currentVals = c.values || (typeof c.value === 'string' && c.value ? c.value.split(',').map((s) => s.trim()) : []);
        const exists = currentVals.includes(freq);
        const updated = exists ? currentVals.filter((f) => f !== freq) : [...currentVals, freq];
        return {
          ...c,
          values: updated,
          value: updated.join(', '),
        };
      })
    );
  };

  // Status multi-selection helper
  const handleToggleStatus = (condId: string, statusVal: string) => {
    setRuleCustomConditions((prev) =>
      prev.map((c) => {
        if (c.id !== condId) return c;
        const currentVals = c.values || (typeof c.value === 'string' && c.value ? c.value.split(',').map((s) => s.trim()) : []);
        const exists = currentVals.includes(statusVal);
        const updated = exists ? currentVals.filter((s) => s !== statusVal) : [...currentVals, statusVal];
        return {
          ...c,
          values: updated,
          value: updated.join(', '),
        };
      })
    );
  };

  // Close rule department dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ruleDeptDropdownRef.current && !ruleDeptDropdownRef.current.contains(event.target as Node)) {
        setIsRuleDeptDropdownOpen(false);
      }
    };
    if (isRuleDeptDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRuleDeptDropdownOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Weight is compulsory between 1 and 100
    if (!weight || weight < 1 || weight > 100) return;

    const legacyDepts = rules.length > 0 ? (rules[0].applicableDepartments || ['All']) : ['All'];
    const applicableTo = legacyDepts.includes('All') ? 'All' : legacyDepts.join(', ');

    let finalValue = value;
    if (type === 'formula') {
      finalValue = evaluationResult.isValid ? evaluationResult.value : value;
    }

    onSave({
      name: name.trim(),
      type,
      value: finalValue,
      formula: type === 'formula' ? formula.trim() : undefined,
      applicableTo,
      applicableDepartments: legacyDepts,
      applicableEmployeeTypes: rules.length > 0 ? (rules[0].applicableEmployeeTypes || ['All']) : ['All'],
      applicablePayGrades: rules.length > 0 ? (rules[0].applicablePayGrades || ['All']) : ['All'],
      grossSalaryCondition: rules.length > 0 ? rules[0].grossSalaryCondition : { enabled: false, operator: '>=', value: 3000 },
      customConditions: rules.flatMap((r) => r.customConditions || []),
      rules,
      weight,
      calculationBasis,
      isEnabled,
      description: description.trim(),
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className={`w-full max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all duration-300 ${
          isEditorOpen ? 'max-w-4xl' : 'max-w-xl'
        }`}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingDeduction ? 'Edit Corporate Deduction' : 'Add Corporate Automated Deduction'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                  Priority Weighted
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure corporate automated deductions with conditional employee mappings and priority ordering.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <form id="deduction-form" onSubmit={handleSubmit} className="space-y-5">
            <div className={`grid gap-6 ${isEditorOpen ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
              {/* Main Form Fields */}
              <div className={`space-y-4 ${isEditorOpen ? 'lg:col-span-7' : 'w-full'}`}>
                {/* Deduction Name */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1">
                    Deduction Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Statutory Pension, Healthcare Scheme, Company Laptop Levy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none transition"
                  />
                </div>

                {/* Calculation Type Selector */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1.5">
                    Calculation Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setType('percentage');
                        setIsEditorOpen(false);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        type === 'percentage'
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>Percentage</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setType('fixed');
                        setIsEditorOpen(false);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        type === 'fixed'
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Fixed Amount</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setType('formula');
                        setIsEditorOpen(true);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        type === 'formula'
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Formula Builder</span>
                    </button>
                  </div>
                </div>

                {/* Percentage or Fixed Value Input */}
                {type !== 'formula' && (
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1">
                      {type === 'percentage' ? 'Percentage Rate (%)' : `Fixed Amount (${currencySymbol})`} *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={type === 'percentage' ? '0.1' : '1'}
                        min="0"
                        required
                        value={value}
                        onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none transition"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                        {type === 'percentage' ? '%' : currencySymbol}
                      </span>
                    </div>
                  </div>
                )}

                {/* Formula Expression + Direct Live Sandbox underneath */}
                {type === 'formula' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-purple-900 dark:text-purple-300 font-semibold text-xs flex items-center gap-1.5">
                        <Code2 className="w-4 h-4 text-purple-600" />
                        <span>Formula Expression:</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsEditorOpen(!isEditorOpen)}
                        className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{isEditorOpen ? 'Hide HR Tag Palette' : 'Show HR Tag Palette'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        rows={3}
                        value={formula}
                        onChange={(e) => setFormula(e.target.value)}
                        placeholder="e.g. ({base_salary} * 0.08) + 15"
                        className="w-full p-3 rounded-xl bg-slate-900 text-purple-300 font-mono text-xs border border-purple-900/60 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none leading-relaxed"
                      />
                    </div>

                    {/* LIVE FORMULA SANDBOX TEST - Moved directly under formula expression */}
                    <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                          <Play className="w-3 h-3 text-purple-500 fill-purple-500" />
                          Live Formula Sandbox Test
                        </span>
                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                          Real-time Evaluator
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                            Test Base Salary ({currencySymbol})
                          </label>
                          <input
                            type="number"
                            step="100"
                            value={testSalary}
                            onChange={(e) => setTestSalary(parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 font-mono text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                            Days in Month
                          </label>
                          <input
                            type="number"
                            value={testDaysInMonth}
                            onChange={(e) => setTestDaysInMonth(parseInt(e.target.value, 10) || 30)}
                            className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 font-mono text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-800/80 flex items-center justify-between">
                        <div className="space-y-0.5 pr-2">
                          <div className="text-[9px] font-mono text-slate-400 uppercase">
                            Evaluated Expression:
                          </div>
                          <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
                            {evaluationResult.evaluatedExpression || 'N/A'}
                          </div>
                          {!evaluationResult.isValid && (
                            <div className="text-[10px] text-rose-500 font-semibold flex items-center gap-1 mt-0.5">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{evaluationResult.error || 'Syntax error in formula'}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[9px] font-mono text-slate-400 uppercase">Computed Deduction:</div>
                          <div className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                            {evaluationResult.isValid ? (
                              `${currencySymbol}${evaluationResult.value.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            ) : (
                              <span className="text-rose-500 text-xs">Error</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* APPLICABLE CONDITIONAL MAPPING SECTION */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-rose-500" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                          Applicable Conditional Mapping
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Configure targeted rulesets (Rule 1, Rule 2, etc.) for this deduction
                        </span>
                      </div>
                    </div>
                    {rules.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRules([])}
                        className="text-[10px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-medium cursor-pointer"
                      >
                        Reset (Apply to All Staff)
                      </button>
                    )}
                  </div>

                  {rules.length === 0 ? (
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No condition rules configured. By default, this deduction will apply across all staff members.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreateRule}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create a Rule</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="space-y-1.5">
                        {rules.map((rule, idx) => (
                          <div
                            key={rule.id || idx}
                            className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-black font-mono flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <div>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {rule.name || `Rule ${idx + 1}`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditRule(idx)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRule(idx)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                title="Delete rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenCreateRule}
                        className="w-full py-2 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add a different condition rule</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Description / Audit Note */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1">
                    Description & Policy Notes
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Statutory pension plan enacted under company compliance framework"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-rose-500 resize-none transition"
                  />
                </div>

                {/* Active Status Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`w-4 h-4 ${isEnabled ? 'text-emerald-500' : 'text-slate-400'}`}
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        Rule Status: {isEnabled ? 'Active' : 'Disabled'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isEnabled
                          ? 'Deduction will automatically compute during target payroll runs'
                          : 'Rule is paused and will not impact current pay cycles'}
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Formula Editor Side Panel (HR Variables & Presets) */}
              {isEditorOpen && (
                <div className="lg:col-span-5 space-y-4 lg:border-l lg:border-slate-200 lg:dark:border-slate-800 lg:pl-6">
                  {/* Category Filter Tabs */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Dynamic HR Variables
                      </span>
                      <div className="flex items-center gap-1">
                        {(['all', 'core', 'rates', 'time'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedTagCategory(cat)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition cursor-pointer ${
                              selectedTagCategory === cat
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {FORMULA_TAGS.filter(
                        (item) => selectedTagCategory === 'all' || item.category === selectedTagCategory
                      ).map((item) => (
                        <div
                          key={item.tag}
                          onClick={() => handleInsertTag(item.tag)}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer transition flex items-center justify-between text-xs group"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-[11px]">
                                {item.tag}
                              </span>
                              <span className="text-[10px] text-slate-400">({item.label})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                              {item.description}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-semibold text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 shrink-0">
                            {item.sampleValue}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Math Operators */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Math Operators:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {['+', '-', '*', '/', '(', ')', '%'].map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => handleInsertOperator(op)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono font-bold text-xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          {op}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormula('')}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-semibold text-[10px] border border-rose-200 dark:border-rose-900 ml-auto cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Corporate Formula Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Corporate Formula Presets:
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {CORPORATE_PRESETS.map((preset) => (
                        <div
                          key={preset.title}
                          onClick={() => setFormula(preset.formula)}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer transition flex items-center justify-between text-xs group"
                        >
                          <div>
                            <div className="font-bold text-[11px] text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300">
                              {preset.title}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {preset.formula}
                            </div>
                          </div>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 font-bold">
                            Apply
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Modal Footer with % Weight Priority & Base/Net Toggle */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Footer Left: % Based Weight + Calculation Basis Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Priority Weight (1-100%, compulsory, unique) */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-rose-500" />
                <span>Priority Weight:</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                >
                  {Array.from({ length: 100 }, (_, i) => 100 - i).map((w) => {
                    const isTaken = usedWeights.has(w);
                    return (
                      <option key={w} value={w} disabled={isTaken}>
                        {w}% {isTaken ? '(Assigned)' : w === 100 ? '(Highest Priority)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <span
                className="text-[10px] text-slate-400 hidden sm:inline"
                title="Deductions with 100% are executed first, followed by lower weights"
              >
                (100% = 1st)
              </span>
            </div>

            {/* Calculation Basis Toggle: Base vs Net */}
            <div className="flex items-center gap-1.5 pl-2 sm:border-l border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Basis:
              </span>
              <div
                className={`inline-flex p-0.5 rounded-lg border ${
                  isToggleDisabled
                    ? 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80 cursor-not-allowed'
                    : 'bg-slate-200/80 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                }`}
                title={
                  isNetDisbursalInFormula
                    ? 'Formula contains net_disbursal: locked to Net calculation'
                    : type === 'formula'
                    ? 'Formula calculation: locked to Base calculation'
                    : 'Toggle calculation between Base Salary and Net Disbursal'
                }
              >
                <button
                  type="button"
                  disabled={isToggleDisabled}
                  onClick={() => setCalculationBasis('base')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                    calculationBasis === 'base'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  } ${isToggleDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Base
                </button>
                <button
                  type="button"
                  disabled={isToggleDisabled}
                  onClick={() => setCalculationBasis('net')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                    calculationBasis === 'net'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  } ${isToggleDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Net
                </button>
              </div>
              {isNetDisbursalInFormula ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  net_disbursal lock
                </span>
              ) : type === 'formula' ? (
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Formula Base
                </span>
              ) : null}
            </div>
          </div>

          {/* Footer Right: Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="deduction-form"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingDeduction ? 'Update Deduction' : 'Save Corporate Deduction'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL: Deduction Rule Configuration */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Sub-modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingRuleIndex !== null ? `Edit ${rules[editingRuleIndex]?.name || 'Rule'}` : `Configure ${ruleName}`}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Define criteria that qualify staff for this corporate deduction
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Rule Name */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Rule 1"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* 1. Department Mapping */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Applicable Departments:</span>
                  </span>
                  {selectedRuleSpecificDepts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRuleDepartments(['All'])}
                      className="text-[10px] text-slate-400 hover:text-rose-500 font-normal cursor-pointer"
                    >
                      Clear (All Departments)
                    </button>
                  )}
                </label>

                <div
                  className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 relative"
                  ref={ruleDeptDropdownRef}
                >
                  {selectedRuleSpecificDepts.length === 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRuleDeptDropdownOpen(!isRuleDeptDropdownOpen)}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                      >
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>All Departments (Company-wide)</span>
                        <ChevronDown
                          className={`w-3 h-3 text-slate-400 transition-transform ${
                            isRuleDeptDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isRuleDeptDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl py-1.5 z-50 text-xs max-h-56 overflow-y-auto">
                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Select Department
                          </div>
                          {availableDepartments.map((deptName) => (
                            <button
                              key={deptName}
                              type="button"
                              onClick={() => {
                                handleAddRuleDepartment(deptName);
                                setIsRuleDeptDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 flex items-center justify-between transition cursor-pointer"
                            >
                              <span className="font-medium">{deptName}</span>
                              <Plus className="w-3 h-3 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {selectedRuleSpecificDepts.map((deptName) => (
                        <span
                          key={deptName}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold"
                        >
                          <span>{deptName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRuleDepartment(deptName)}
                            className="p-0.5 rounded hover:bg-rose-200/60 dark:hover:bg-rose-900/60 text-rose-500 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsRuleDeptDropdownOpen(!isRuleDeptDropdownOpen)}
                          className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-slate-400" />
                          <span>Add Dept</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {isRuleDeptDropdownOpen && (
                          <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl py-1.5 z-50 text-xs max-h-56 overflow-y-auto">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Add Another Department
                            </div>
                            {availableDepartments
                              .filter((d) => !selectedRuleSpecificDepts.includes(d))
                              .map((deptName) => (
                                <button
                                  key={deptName}
                                  type="button"
                                  onClick={() => {
                                    handleAddRuleDepartment(deptName);
                                    setIsRuleDeptDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 flex items-center justify-between transition cursor-pointer"
                                >
                                  <span className="font-medium">{deptName}</span>
                                  <Plus className="w-3 h-3 text-slate-400" />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 2. Employee Type / Category */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Employee Type / Category:</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRuleEmployeeType('All')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      ruleEmployeeTypes.includes('All')
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    All Types
                  </button>
                  {EMPLOYEE_TYPE_OPTIONS.map((cat) => {
                    const isSelected =
                      !ruleEmployeeTypes.includes('All') && ruleEmployeeTypes.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleRuleEmployeeType(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Pay Grade Mapping */}
              <div className="space-y-1.5">
                <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pay Grade Tier:</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleRulePayGrade('All')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      rulePayGrades.includes('All')
                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    All Pay Grades
                  </button>
                  {availablePayGrades.map((grade) => {
                    const isSelected =
                      !rulePayGrades.includes('All') && rulePayGrades.includes(grade);
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => handleToggleRulePayGrade(grade)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {grade}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Gross Salary Numeric Logic Conditional Statement */}
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ruleGrossSalaryCondition.enabled}
                      onChange={(e) =>
                        setRuleGrossSalaryCondition({
                          ...ruleGrossSalaryCondition,
                          enabled: e.target.checked,
                        })
                      }
                      className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                    />
                    <span>Gross Salary Numeric Logic Conditional Statement</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ruleGrossSalaryCondition.enabled ? 'Active Rule' : 'Disabled'}
                  </span>
                </div>

                {ruleGrossSalaryCondition.enabled && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      If Gross Salary is
                    </span>
                    <select
                      value={ruleGrossSalaryCondition.operator}
                      onChange={(e) =>
                        setRuleGrossSalaryCondition({
                          ...ruleGrossSalaryCondition,
                          operator: e.target.value as any,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                    >
                      <option value=">">&gt; (Greater than)</option>
                      <option value=">=">&gt;= (At least)</option>
                      <option value="<">&lt; (Less than)</option>
                      <option value="<=">&lt;= (At most)</option>
                      <option value="==">== (Exactly equals)</option>
                      <option value="!=">!= (Not equal to)</option>
                    </select>
                    <div className="relative inline-block">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={ruleGrossSalaryCondition.value}
                        onChange={(e) =>
                          setRuleGrossSalaryCondition({
                            ...ruleGrossSalaryCondition,
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-6 pr-2.5 py-1.5 w-32 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Applies only when salary {ruleGrossSalaryCondition.operator} {currencySymbol}
                      {ruleGrossSalaryCondition.value.toLocaleString()})
                    </span>
                  </div>
                )}
              </div>

              {/* 5. Custom Dynamic Conditions */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between relative">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Additional Custom Logic Conditions:
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Tailored attribute rules with multi-select support and conflict prevention.
                    </p>
                  </div>

                  <div className="relative" ref={addConditionMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsAddConditionMenuOpen(!isAddConditionMenuOpen)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add field rule</span>
                      <ChevronDown className="w-3 h-3 text-rose-400" />
                    </button>

                    {/* Attribute Selection Menu */}
                    {isAddConditionMenuOpen && (
                      <div className="absolute right-0 mt-1.5 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl py-2 z-50 text-xs">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1">
                          Select Attribute Condition
                        </div>
                        <div className="space-y-0.5 px-1.5">
                          {CUSTOM_FIELD_OPTIONS.map((opt) => {
                            const isAlreadyUsed = opt.field !== 'custom' && usedConditionFields.has(opt.field);
                            const IconComp = opt.icon;
                            return (
                              <button
                                key={opt.field}
                                type="button"
                                disabled={isAlreadyUsed}
                                onClick={() => handleAddNewConditionField(opt.field)}
                                className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition ${
                                  isAlreadyUsed
                                    ? 'opacity-45 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed text-slate-400'
                                    : 'hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-800 dark:text-slate-200 cursor-pointer group'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`p-1.5 rounded-lg ${
                                      isAlreadyUsed
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform'
                                    }`}
                                  >
                                    <IconComp className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-xs flex items-center gap-1.5">
                                      <span>{opt.label}</span>
                                      {isAlreadyUsed && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 font-mono">
                                          Configured
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {isAlreadyUsed ? 'Multi-select active inside card' : opt.badge}
                                    </div>
                                  </div>
                                </div>
                                {!isAlreadyUsed && <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {ruleCustomConditions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/30">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No custom conditions added to this rule.
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Click <strong className="text-rose-600">Add field rule</strong> to add role, shift, pay frequency, or status filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ruleCustomConditions.map((cond, idx) => {
                      // Determine available departments for Role condition
                      const specificDepts = ruleDepartments.filter((d) => d !== 'All');
                      const availableDeptOptionsForRole =
                        specificDepts.length > 0
                          ? specificDepts
                          : availableDepartments.filter((d) => d !== 'All');

                      const currentRoleDept =
                        cond.departmentScope && availableDeptOptionsForRole.includes(cond.departmentScope)
                          ? cond.departmentScope
                          : availableDeptOptionsForRole[0] || 'Engineering';

                      const availableRolesForDept = getDepartmentRoles(currentRoleDept);
                      const isDeptLockedToSection1 = specificDepts.length === 1;

                      return (
                        <div
                          key={cond.id}
                          className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs"
                        >
                          {/* Top Row: Condition index, Attribute Selector, Operator & Remove */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/70 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono">
                                #{idx + 1}
                              </span>

                              {/* Field Type Selector (with disabled state for already used attributes) */}
                              <select
                                value={cond.field}
                                onChange={(e) => handleChangeConditionField(cond.id, e.target.value)}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                              >
                                {CUSTOM_FIELD_OPTIONS.map((opt) => {
                                  const isUsedElsewhere =
                                    opt.field !== 'custom' &&
                                    cond.field !== opt.field &&
                                    usedConditionFields.has(opt.field);
                                  return (
                                    <option key={opt.field} value={opt.field} disabled={isUsedElsewhere}>
                                      {opt.label} {isUsedElsewhere ? '(Already configured)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Operator selector for categorical attributes */}
                              {(cond.field === 'role' ||
                                cond.field === 'shiftSchedule' ||
                                cond.field === 'payFrequency' ||
                                cond.field === 'status') && (
                                <select
                                  value={cond.operator === 'not_in' ? 'not_in' : 'in'}
                                  onChange={(e) => handleUpdateRuleCondition(cond.id, { operator: e.target.value })}
                                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
                                >
                                  <option value="in">Matches any selected</option>
                                  <option value="not_in">Excludes selected</option>
                                </select>
                              )}

                              {/* Remove Condition Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveRuleCondition(cond.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Remove condition rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Specific Body Input for Role / Job Title */}
                          {cond.field === 'role' && (
                            <div className="space-y-2">
                              {/* Department Dropdown for Role */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">
                                  Department:
                                </span>
                                <select
                                  value={currentRoleDept}
                                  disabled={isDeptLockedToSection1}
                                  onChange={(e) => {
                                    handleUpdateRuleCondition(cond.id, {
                                      departmentScope: e.target.value,
                                      values: [],
                                      value: '',
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none flex-1 ${
                                    isDeptLockedToSection1 ? 'opacity-85 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
                                  }`}
                                >
                                  {availableDeptOptionsForRole.map((dept) => (
                                    <option key={dept} value={dept}>
                                      {dept}
                                    </option>
                                  ))}
                                </select>

                                {isDeptLockedToSection1 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono border border-emerald-200 dark:border-emerald-800 shrink-0">
                                    Auto-synced from Section 1
                                  </span>
                                ) : specificDepts.length > 1 ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono border border-blue-200 dark:border-blue-800 shrink-0">
                                    Filtered by Section 1 ({specificDepts.length} depts)
                                  </span>
                                ) : null}
                              </div>

                              {/* Multi-select Role Options */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                                    <Briefcase className="w-3 h-3 text-slate-400" />
                                    <span>
                                      Role(s) in <strong className="text-slate-800 dark:text-slate-200">{currentRoleDept}</strong> ({(cond.values || []).length} selected):
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {availableRolesForDept.length > 0 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleSelectAllRoles(cond.id, availableRolesForDept)}
                                          className="text-rose-600 dark:text-rose-400 hover:underline text-[10px] font-bold cursor-pointer"
                                        >
                                          Select All
                                        </button>
                                        <span className="text-slate-300 dark:text-slate-700">|</span>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleClearRoles(cond.id)}
                                      className="text-slate-500 hover:underline text-[10px] font-semibold cursor-pointer"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                {availableRolesForDept.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
                                    {availableRolesForDept.map((roleTitle) => {
                                      const isSelected = (cond.values || []).includes(roleTitle);
                                      return (
                                        <button
                                          key={roleTitle}
                                          type="button"
                                          onClick={() => handleToggleRole(cond.id, roleTitle)}
                                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                            isSelected
                                              ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 shadow-2xs'
                                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                          }`}
                                        >
                                          {isSelected && <Check className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                                          <span>{roleTitle}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5">
                                    <p className="text-[11px] text-slate-400">
                                      No roles registered under {currentRoleDept} yet. Enter custom role titles below:
                                    </p>
                                    <input
                                      type="text"
                                      placeholder="e.g. Lead Engineer, Junior Associate (comma-separated)..."
                                      value={cond.value}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const roles = val.split(',').map((s) => s.trim()).filter(Boolean);
                                        handleUpdateRuleCondition(cond.id, {
                                          value: val,
                                          values: roles,
                                        });
                                      }}
                                      className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Specific Body Input for Shift Schedule */}
                          {cond.field === 'shiftSchedule' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    Company Shift Rosters ({(cond.values || []).length} selected):
                                  </span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllShifts(cond.id, allCompanyShifts.map((s) => s.name))}
                                    className="text-amber-600 dark:text-amber-400 hover:underline text-[10px] font-bold cursor-pointer"
                                  >
                                    Select All
                                  </button>
                                  <span className="text-slate-300 dark:text-slate-700">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleClearShifts(cond.id)}
                                    className="text-slate-500 hover:underline text-[10px] font-semibold cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                {allCompanyShifts.map((shift) => {
                                  const isSelected = (cond.values || []).includes(shift.name);
                                  return (
                                    <button
                                      key={shift.id}
                                      type="button"
                                      onClick={() => handleToggleShift(cond.id, shift.name)}
                                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-2xs'
                                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{shift.name}</span>
                                      {isSelected && <Check className="w-3 h-3 text-amber-600 dark:text-amber-400 ml-0.5" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Specific Body Input for Pay Frequency */}
                          {cond.field === 'payFrequency' && (
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>Select Applicable Pay Frequencies:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                {['Monthly', 'Bi-Weekly', 'Weekly'].map((freq) => {
                                  const isSelected = (cond.values || []).includes(freq);
                                  return (
                                    <button
                                      key={freq}
                                      type="button"
                                      onClick={() => handleToggleFrequency(cond.id, freq)}
                                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-2xs'
                                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span>{freq}</span>
                                      {isSelected && <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Specific Body Input for Staff Status */}
                          {cond.field === 'status' && (
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <UserCheck className="w-3 h-3 text-slate-400" />
                                <span>Select Applicable Employment Statuses:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                {['Active', 'Probation', 'On Leave', 'Suspended'].map((statusOption) => {
                                  const isSelected = (cond.values || []).includes(statusOption);
                                  return (
                                    <button
                                      key={statusOption}
                                      type="button"
                                      onClick={() => handleToggleStatus(cond.id, statusOption)}
                                      className={`px-3 py-1 rounded-md text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span>{statusOption}</span>
                                      {isSelected && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Specific Body Input for Base Salary Numeric Condition */}
                          {cond.field === 'estimatedMonthlySalary' && (
                            <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                When Base Salary is:
                              </span>
                              <select
                                value={cond.operator}
                                onChange={(e) => handleUpdateRuleCondition(cond.id, { operator: e.target.value })}
                                className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                              >
                                <option value=">=">&gt;= (At least)</option>
                                <option value=">">&gt; (Greater than)</option>
                                <option value="<=">&lt;= (At most)</option>
                                <option value="<">&lt; (Less than)</option>
                                <option value="==">== (Equals)</option>
                                <option value="!=">!= (Does not equal)</option>
                              </select>

                              <div className="relative flex-1 min-w-[120px]">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">
                                  {currencySymbol}
                                </span>
                                <input
                                  type="number"
                                  placeholder="3000"
                                  value={cond.value}
                                  onChange={(e) => handleUpdateRuleCondition(cond.id, { value: Number(e.target.value) || 0 })}
                                  className="w-full pl-6 pr-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {/* Specific Body Input for Custom Attribute Key/Value */}
                          {cond.field === 'custom' && (
                            <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <input
                                type="text"
                                placeholder="Attribute key (e.g. branch, unionCode)..."
                                value={cond.customKey || ''}
                                onChange={(e) => handleUpdateRuleCondition(cond.id, { customKey: e.target.value })}
                                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white flex-1 min-w-[140px] outline-none"
                              />

                              <select
                                value={cond.operator}
                                onChange={(e) => handleUpdateRuleCondition(cond.id, { operator: e.target.value })}
                                className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                              >
                                <option value="==">== (Equals)</option>
                                <option value="!=">!= (Does not equal)</option>
                                <option value="contains">Contains Text</option>
                              </select>

                              <input
                                type="text"
                                placeholder="Value to match..."
                                value={cond.value}
                                onChange={(e) => handleUpdateRuleCondition(cond.id, { value: e.target.value })}
                                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white flex-1 min-w-[120px] outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sub-modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentRule}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingRuleIndex !== null ? 'Save Rule Changes' : 'Add Rule'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
