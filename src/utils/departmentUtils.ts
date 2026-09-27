import { DepartmentInfo, DepartmentRole } from '../types';
import { loadCompanyData, saveCompanyData, STORAGE_KEYS } from './companyStorage';

/**
 * Deduplicates and consolidates a list of departments.
 * Handles:
 * 1. Multiple departments with duplicate or colliding IDs.
 * 2. Multiple departments with the same name (case-insensitive).
 * 3. Multiple departments with the same short code.
 * Merges roles and job description items without losing duties.
 */
export function deduplicateDepartmentsWithStats(rawList: DepartmentInfo[]): {
  deduplicated: DepartmentInfo[];
  hasDuplicates: boolean;
} {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return { deduplicated: [], hasDuplicates: false };
  }

  let hadDuplicates = false;
  const seenNames = new Map<string, DepartmentInfo>(); // lowerName -> canonical dept
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();

  const consolidated: DepartmentInfo[] = [];

  for (const dept of rawList) {
    if (!dept || typeof dept !== 'object') {
      hadDuplicates = true;
      continue;
    }

    const trimmedName = (dept.name || '').trim();
    if (
      !trimmedName ||
      ['unassigned', 'n/a', 'none', 'null', 'undefined'].includes(trimmedName.toLowerCase())
    ) {
      hadDuplicates = true;
      continue;
    }

    const nameKey = trimmedName.toLowerCase();

    // Check if a department with this name is already registered
    if (seenNames.has(nameKey)) {
      hadDuplicates = true;
      const canonical = seenNames.get(nameKey)!;

      // Merge roles (union by role title, case-insensitive)
      const existingRoleTitles = new Set(
        (canonical.roles || []).map((r) => (r.title || '').trim().toLowerCase())
      );
      const mergedRoles: DepartmentRole[] = [...(canonical.roles || [])];

      (dept.roles || []).forEach((r) => {
        const titleKey = (r.title || '').trim().toLowerCase();
        if (!titleKey) return;
        if (!existingRoleTitles.has(titleKey)) {
          existingRoleTitles.add(titleKey);
          const cleanR: DepartmentRole = {
            ...r,
            id: r.id || `role-${Date.now()}-${mergedRoles.length}`,
            title: (r.title || '').trim(),
            jobDescription:
              (r.jobDescription || '').trim() ||
              (Array.isArray(r.items) && r.items.length > 0
                ? r.items.map((it) => it.text).join('; ')
                : ''),
            items: Array.isArray(r.items) ? [...r.items] : [],
          };
          mergedRoles.push(cleanR);
        } else {
          // Merge job description items and text if present
          const targetRole = mergedRoles.find(
            (mr) => (mr.title || '').trim().toLowerCase() === titleKey
          );
          if (targetRole) {
            // Retain/upgrade job description text
            if (
              r.jobDescription &&
              r.jobDescription.trim() &&
              (!targetRole.jobDescription || targetRole.jobDescription.length < r.jobDescription.length)
            ) {
              targetRole.jobDescription = r.jobDescription.trim();
            }

            if (Array.isArray(r.items) && r.items.length > 0) {
              const existingItemTexts = new Set(
                (targetRole.items || []).map((it) => it.text.trim().toLowerCase())
              );
              const newItems = r.items.filter(
                (it) => it.text && !existingItemTexts.has(it.text.trim().toLowerCase())
              );
              if (newItems.length > 0) {
                targetRole.items = [...(targetRole.items || []), ...newItems];
              }
              if (!targetRole.jobDescription && targetRole.items && targetRole.items.length > 0) {
                targetRole.jobDescription = targetRole.items.map((it) => it.text).join('; ');
              }
            }
          }
        }
      });
      canonical.roles = mergedRoles;

      // Retain the head of department if canonical is unassigned
      if (
        (!canonical.headOfDepartment || canonical.headOfDepartment === 'Unassigned') &&
        dept.headOfDepartment &&
        dept.headOfDepartment !== 'Unassigned'
      ) {
        canonical.headOfDepartment = dept.headOfDepartment;
      }

      // Retain description if canonical is default
      if (
        (!canonical.description || canonical.description.startsWith('Department for ')) &&
        dept.description &&
        dept.description.trim()
      ) {
        canonical.description = dept.description.trim();
      }

      continue;
    }

    // New unique department
    const cleanedRoles: DepartmentRole[] = Array.isArray(dept.roles)
      ? dept.roles
          .filter((r) => r && (r.title || '').trim() !== '')
          .map((r, rIdx) => ({
            ...r,
            id: r.id || `role-${Date.now()}-${rIdx}`,
            title: (r.title || '').trim(),
            jobDescription:
              (r.jobDescription || '').trim() ||
              (Array.isArray(r.items) && r.items.length > 0
                ? r.items.map((it) => it.text).join('; ')
                : ''),
            items: Array.isArray(r.items) ? [...r.items] : [],
          }))
      : [];

    const cleanedDept: DepartmentInfo = {
      ...dept,
      name: trimmedName,
      headOfDepartment: dept.headOfDepartment?.trim() || 'Unassigned',
      description: dept.description?.trim() || `Department for ${trimmedName}`,
      roles: cleanedRoles,
    };

    seenNames.set(nameKey, cleanedDept);
    consolidated.push(cleanedDept);
  }

  // Second pass: Ensure all IDs and Codes are strictly unique
  const finalDepts: DepartmentInfo[] = [];

  for (let i = 0; i < consolidated.length; i++) {
    const dept = consolidated[i];

    // Ensure strictly unique ID
    let uniqueId = dept.id && dept.id.trim() ? dept.id.trim() : '';
    if (!uniqueId || seenIds.has(uniqueId)) {
      hadDuplicates = true;
      const baseCode = (dept.code || dept.name || 'dept')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
        .slice(0, 4) || 'dept';
      uniqueId = `dept-${baseCode}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
    }
    seenIds.add(uniqueId);
    dept.id = uniqueId;

    // Ensure strictly unique Code
    let rawCode = (dept.code || '').trim().toUpperCase();
    if (!rawCode) {
      rawCode = dept.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'DPT';
    }
    let uniqueCode = rawCode;
    let counter = 1;
    while (seenCodes.has(uniqueCode)) {
      hadDuplicates = true;
      uniqueCode = `${rawCode}${counter++}`;
    }
    seenCodes.add(uniqueCode);
    dept.code = uniqueCode;

    finalDepts.push(dept);
  }

  if (rawList.length !== finalDepts.length) {
    hadDuplicates = true;
  }

  return { deduplicated: finalDepts, hasDuplicates: hadDuplicates };
}

/**
 * Deduplicates and cleans a list of departments, returning the cleaned array directly.
 */
export function deduplicateDepartments(rawList: DepartmentInfo[]): DepartmentInfo[] {
  return deduplicateDepartmentsWithStats(rawList).deduplicated;
}

/**
 * Loads departments from company storage, cleans and deduplicates them,
 * and updates storage if any duplicates or collided IDs were fixed.
 */
export function getCleanDepartments(companyNameOrId?: string): DepartmentInfo[] {
  try {
    const raw = loadCompanyData<DepartmentInfo[]>(STORAGE_KEYS.DEPARTMENTS, companyNameOrId, []);
    const { deduplicated, hasDuplicates } = deduplicateDepartmentsWithStats(raw);
    if (hasDuplicates && companyNameOrId) {
      saveCompanyData(STORAGE_KEYS.DEPARTMENTS, deduplicated, companyNameOrId);
    }
    return deduplicated;
  } catch (err) {
    console.error('Failed to load clean departments:', err);
    return [];
  }
}

/**
 * Saves cleaned departments to company storage.
 */
export function saveCleanDepartments(
  departments: DepartmentInfo[],
  companyNameOrId?: string
): DepartmentInfo[] {
  const deduplicated = deduplicateDepartments(departments);
  if (companyNameOrId) {
    try {
      saveCompanyData(STORAGE_KEYS.DEPARTMENTS, deduplicated, companyNameOrId);
    } catch (err) {
      console.error('Failed to save deduplicated departments:', err);
    }
  }
  return deduplicated;
}
