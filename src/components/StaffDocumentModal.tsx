import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Printer,
  Download,
  FileCheck,
  Building2,
  FileText,
  Sparkles,
  CheckCircle2,
  Check,
  UserCheck,
  Clock,
  Briefcase,
  ChevronRight,
  BadgeDollarSign,
  Target,
} from 'lucide-react';
import {
  StaffMember,
  AppSettings,
  DocumentSection,
  DocumentItemType,
  DocumentHeaderMetaConfig,
  SignatureConfig,
} from '../types';
import {
  DEFAULT_JD_SECTIONS,
  DEFAULT_CONFIRMATION_SECTIONS,
  DEFAULT_APPOINTMENT_SECTIONS,
  DEFAULT_APPRAISAL_SECTIONS,
  DEFAULT_HEADER_META,
  DEFAULT_APPRAISAL_HEADER_META,
  DEFAULT_SIGNATURES,
  DEFAULT_APPRAISAL_SIGNATURES,
  getPrefix,
  getListPrefix,
  replaceDocumentTags,
  getActiveOrganizationName,
  getStaffRoleDutiesInfo,
} from '../utils/documentTemplates';

export type DocumentTypeTab = 'jd' | 'confirmation' | 'appointment' | 'appraisal';

interface StaffDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  settings?: AppSettings;
  initialTab?: DocumentTypeTab | null;
  isNewStaffPrompt?: boolean;
  onFinish?: () => void;
}

export const StaffDocumentModal: React.FC<StaffDocumentModalProps> = ({
  isOpen,
  onClose,
  staff,
  settings,
  initialTab = null,
  isNewStaffPrompt = false,
  onFinish,
}) => {
  const [activeTab, setActiveTab] = useState<DocumentTypeTab | null>(initialTab || (isNewStaffPrompt ? null : 'confirmation'));
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || (isNewStaffPrompt ? null : 'confirmation'));
    }
  }, [isOpen, initialTab, isNewStaffPrompt, staff?.id]);

  if (!isOpen || !staff) return null;

  const customCompanyName = (
    activeTab === 'jd'
      ? settings?.jdCompanyName
      : activeTab === 'confirmation'
      ? settings?.confirmationCompanyName
      : activeTab === 'appointment'
      ? settings?.appointmentCompanyName
      : settings?.appraisalCompanyName
  );
  const companyName = (customCompanyName || settings?.companyName || getActiveOrganizationName(settings)).trim();
  const roleDuties = getStaffRoleDutiesInfo(staff);

  // Branding: Logo, Line Color, Text Color
  const logo = (
    activeTab === 'jd'
      ? settings?.jdLogo || settings?.companyLogo
      : activeTab === 'confirmation'
      ? settings?.confirmationLogo || settings?.companyLogo
      : activeTab === 'appointment'
      ? settings?.appointmentLogo || settings?.companyLogo
      : settings?.appraisalLogo || settings?.companyLogo
  );

  const lineColor = (
    activeTab === 'jd'
      ? settings?.jdLineColor || '#0d9488'
      : activeTab === 'confirmation'
      ? settings?.confirmationLineColor || '#2563eb'
      : activeTab === 'appointment'
      ? settings?.appointmentLineColor || '#4f46e5'
      : settings?.appraisalLineColor || '#d97706'
  );

  const textColor = (
    activeTab === 'jd'
      ? settings?.jdTextColor || '#0f172a'
      : activeTab === 'confirmation'
      ? settings?.confirmationTextColor || '#0f172a'
      : activeTab === 'appointment'
      ? settings?.appointmentTextColor || '#0f172a'
      : settings?.appraisalTextColor || '#0f172a'
  );

  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const effectiveDate = staff.joinDate
    ? new Date(staff.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : issueDate;

  // Active Sections & Config per Tab
  const getActiveDocumentConfig = () => {
    switch (activeTab) {
      case 'jd': {
        const title = settings?.jdDocumentTitle || 'OFFICIAL JOB DESCRIPTION & OPERATIONAL MANDATE';
        const sections: DocumentSection[] = (settings?.jdSections && settings.jdSections.length > 0)
          ? settings.jdSections
          : DEFAULT_JD_SECTIONS;
        const hrSig = settings?.jdHrSigLabel || 'Authorized HR / Management Representative';
        const empSig = settings?.jdEmployeeSigLabel || 'Employee Acceptance & Acknowledgment';
        const headerMeta: DocumentHeaderMetaConfig = settings?.jdHeaderMeta || DEFAULT_HEADER_META;
        const signatures: SignatureConfig = settings?.jdSignatures || {
          layout: '2_col',
          signatures: [
            { id: 'sig-1', title: hrSig, subtitle: 'Date: ____ / ____ / ________' },
            { id: 'sig-2', title: empSig, subtitle: 'Date: ____ / ____ / ________' },
          ],
        };
        return { title, sections, hrSig, empSig, headerMeta, signatures, typeLabel: 'Job Description' };
      }
      case 'appraisal': {
        const title = settings?.appraisalDocumentTitle || 'OFFICIAL PERFORMANCE APPRAISAL & KPI EVALUATION';
        const sections: DocumentSection[] = (settings?.appraisalSections && settings.appraisalSections.length > 0)
          ? settings.appraisalSections
          : DEFAULT_APPRAISAL_SECTIONS;
        const hrSig = settings?.appraisalHrSigLabel || 'Appraising Supervisor / Reviewer Signature';
        const empSig = settings?.appraisalEmployeeSigLabel || 'Appraisee Acknowledgment & Signature';
        const headerMeta: DocumentHeaderMetaConfig = settings?.appraisalHeaderMeta || DEFAULT_APPRAISAL_HEADER_META;
        const signatures: SignatureConfig = settings?.appraisalSignatures || DEFAULT_APPRAISAL_SIGNATURES;
        return { title, sections, hrSig, empSig, headerMeta, signatures, typeLabel: 'Performance Appraisal' };
      }
      case 'appointment': {
        const title = settings?.appointmentDocumentTitle || 'OFFICIAL LETTER OF APPOINTMENT';
        const sections: DocumentSection[] = (settings?.appointmentSections && settings.appointmentSections.length > 0)
          ? settings.appointmentSections
          : DEFAULT_APPOINTMENT_SECTIONS;
        const hrSig = settings?.appointmentHrSigLabel || 'Authorized Appointing Authority';
        const empSig = settings?.appointmentEmployeeSigLabel || 'Appointee Acceptance Signature';
        const headerMeta: DocumentHeaderMetaConfig = settings?.appointmentHeaderMeta || DEFAULT_HEADER_META;
        const signatures: SignatureConfig = settings?.appointmentSignatures || {
          layout: '2_col',
          signatures: [
            { id: 'sig-1', title: hrSig, subtitle: 'Date: ____ / ____ / ________' },
            { id: 'sig-2', title: empSig, subtitle: 'Date: ____ / ____ / ________' },
          ],
        };
        return { title, sections, hrSig, empSig, headerMeta, signatures, typeLabel: 'Appointment Letter' };
      }
      case 'confirmation':
      default: {
        const title = settings?.confirmationDocumentTitle || 'OFFICIAL LETTER OF EMPLOYMENT CONFIRMATION';
        const sections: DocumentSection[] = (settings?.confirmationSections && settings.confirmationSections.length > 0)
          ? settings.confirmationSections
          : DEFAULT_CONFIRMATION_SECTIONS;
        const hrSig = settings?.confirmationHrSigLabel || 'Authorized HR / Management Representative';
        const empSig = settings?.confirmationEmployeeSigLabel || 'Employee Acceptance & Acknowledgment';
        const headerMeta: DocumentHeaderMetaConfig = settings?.confirmationHeaderMeta || DEFAULT_HEADER_META;
        const signatures: SignatureConfig = settings?.confirmationSignatures || {
          layout: '2_col',
          signatures: [
            { id: 'sig-1', title: hrSig, subtitle: 'Date: ____ / ____ / ________' },
            { id: 'sig-2', title: empSig, subtitle: 'Date: ____ / ____ / ________' },
          ],
        };
        return { title, sections, hrSig, empSig, headerMeta, signatures, typeLabel: 'Confirmation Letter' };
      }
    }
  };

  const docConfig = getActiveDocumentConfig();

  const handleFinishAction = () => {
    if (onFinish) {
      onFinish();
    }
    onClose();
  };

  // Generate Clean Printable HTML Content
  const generateDocHtml = () => {
    const config = getActiveDocumentConfig();
    const renderedSections = config.sections.map((sec, secIdx) => {
      const secPrefix = getPrefix(secIdx, sec.enumeration, false);
      const title = secPrefix + replaceDocumentTags(sec.title, staff, companyName, effectiveDate);

      const renderRoleHtml = (type: DocumentItemType, introText?: string, isSub = false) => {
        const intro = introText
          ? `<p style="font-size: ${isSub ? '10pt' : '10.5pt'}; color: ${textColor}; line-height: 1.6; margin: ${isSub ? '5px 0' : '8px 0'};">${replaceDocumentTags(introText, staff, companyName, effectiveDate)}</p>`
          : '';

        if (type === 'skills') {
          const skillsList = (roleDuties.skills && roleDuties.skills.length > 0)
            ? roleDuties.skills
            : ['Operational Workflow Management', 'Quality Benchmark Compliance', 'Process Optimization', 'Safety Protocols'];
          const skillsHtml = skillsList
            .map((skill) => `<li style="margin-bottom: 4px;"><strong>${replaceDocumentTags(skill, staff, companyName, effectiveDate)}</strong></li>`)
            .join('');
          return `
            ${intro}
            <ul style="padding-left: 20px; font-size: ${isSub ? '10pt' : '10.5pt'}; color: ${textColor}; line-height: 1.6; margin: 6px 0;">
              ${skillsHtml}
            </ul>
          `;
        }

        let itemsToRender: { text: string; isKey?: boolean }[] = [];
        if (type === 'key_roles') {
          itemsToRender = (roleDuties.keyItems && roleDuties.keyItems.length > 0)
            ? roleDuties.keyItems
            : roleDuties.items.filter((i) => i.isKey);
        } else if (type === 'normal_roles') {
          itemsToRender = (roleDuties.normalItems && roleDuties.normalItems.length > 0)
            ? roleDuties.normalItems
            : roleDuties.items.filter((i) => !i.isKey);
        } else {
          itemsToRender = roleDuties.items;
        }

        if (itemsToRender.length === 0) {
          if (type === 'key_roles') {
            itemsToRender = [
              { text: 'Direct operational workflows, key milestones, and team deliverables', isKey: true },
              { text: 'Enforce stringent quality benchmarks, compliance protocols, and safety standards', isKey: true },
            ];
          } else if (type === 'normal_roles') {
            itemsToRender = [
              { text: 'Coordinate daily departmental handovers and routine tasks', isKey: false },
              { text: 'Maintain operating records and routine operational logs', isKey: false },
            ];
          } else {
            itemsToRender = [
              { text: 'Manage daily operational workflows and department deliverables', isKey: false },
              { text: 'Ensure strict compliance with punctuality, shift rosters, and safety procedures', isKey: false },
              { text: 'Maintain quality standards and execute monthly performance targets', isKey: false },
            ];
          }
        }

        const itemsHtml = itemsToRender
          .map((it) => `<li style="margin-bottom: 5px;">${replaceDocumentTags(it.text, staff, companyName, effectiveDate)}</li>`)
          .join('');

        return `
          ${intro}
          <ul style="padding-left: 20px; font-size: ${isSub ? '10pt' : '10.5pt'}; color: ${textColor}; line-height: 1.6; margin: ${isSub ? '5px 0' : '8px 0'};">
            ${itemsHtml}
          </ul>
        `;
      };

      const renderJdTargetsTableHtml = (section: DocumentSection, isSub = false) => {
        const dutyFilter = section.dutyFilter || 'all';
        let duties = roleDuties.items;
        if (dutyFilter === 'key') {
          duties = (roleDuties.keyItems && roleDuties.keyItems.length > 0)
            ? roleDuties.keyItems
            : roleDuties.items.filter((i) => i.isKey);
        } else if (dutyFilter === 'normal') {
          duties = (roleDuties.normalItems && roleDuties.normalItems.length > 0)
            ? roleDuties.normalItems
            : roleDuties.items.filter((i) => !i.isKey);
        }

        if (duties.length === 0) {
          duties = [
            {
              id: 'fb-1',
              text: 'Direct operational workflows, key milestones, and team deliverables',
              target: roleDuties.targets || 'Achieve ≥98% fulfillment benchmark with zero quality breaches',
              weight: 40,
              isKey: true,
            },
            {
              id: 'fb-2',
              text: 'Enforce stringent quality benchmarks, compliance protocols, and safety standards',
              target: roleDuties.targets || '100% compliance across quarterly audit checkpoints',
              weight: 35,
              isKey: true,
            },
            {
              id: 'fb-3',
              text: 'Coordinate daily departmental handovers and routine operational logs',
              target: roleDuties.targets || 'Daily handover logs submitted accurately on time',
              weight: 25,
              isKey: false,
            },
          ];
        }

        const sortedDuties = [...duties];
        if (section.sortByWeight !== false) {
          sortedDuties.sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
        }

        const headersList = (section.tableHeaders && section.tableHeaders.length > 0)
          ? section.tableHeaders
          : [
              'Job Description / Operational Duty',
              'Target / Performance Standard',
              'Weight (%)',
              'Self Rating (1-5)',
              'Supervisor Score (1-5)',
              'Achievement & Remarks',
            ];

        const headerHtml = headersList
          .map((h) => {
            const isWeight = h.toLowerCase().includes('weight');
            return `<th style="border: 1px solid ${lineColor}40; background: ${lineColor}15; padding: ${isSub ? '6px 8px' : '7px 10px'}; text-align: ${isWeight ? 'center' : 'left'}; font-size: ${isSub ? '9pt' : '9.5pt'}; color: ${textColor}; font-weight: 700;">${replaceDocumentTags(h, staff, companyName, effectiveDate)}</th>`;
          })
          .join('');

        const dutyRowsHtml = sortedDuties.map((duty, dIdx) => {
          const customRow = section.tableRows && section.tableRows[dIdx] ? section.tableRows[dIdx] : [];
          const cells = headersList.map((header, cIdx) => {
            let cellContent = '';
            const hLower = header.toLowerCase();
            if (cIdx === 0) {
              cellContent = `<strong>${replaceDocumentTags(duty.text, staff, companyName, effectiveDate)}</strong>`;
            } else if (cIdx === 1) {
              cellContent = replaceDocumentTags(duty.target || roleDuties.targets || 'Achieve designated performance benchmark', staff, companyName, effectiveDate);
            } else if (cIdx === 2 || hLower.includes('weight')) {
              const weightVal = duty.weight !== undefined ? duty.weight : (duty.isKey ? 25 : 15);
              cellContent = `<span style="font-weight: 700; color: ${lineColor};">${weightVal}%</span>`;
            } else {
              if (customRow[cIdx] !== undefined && customRow[cIdx].trim() !== '') {
                cellContent = replaceDocumentTags(customRow[cIdx], staff, companyName, effectiveDate);
              } else if (hLower.includes('rating') || hLower.includes('score')) {
                cellContent = `<span style="color: #94a3b8; font-size: 9pt;">[ &nbsp; &nbsp; ]</span>`;
              } else {
                cellContent = '';
              }
            }

            const isWeight = hLower.includes('weight');
            const isRating = hLower.includes('rating') || hLower.includes('score');
            return `<td style="border: 1px solid ${lineColor}25; padding: ${isSub ? '6px 8px' : '7px 10px'}; font-size: ${isSub ? '9pt' : '9.5pt'}; color: ${textColor}; text-align: ${isWeight || isRating ? 'center' : 'left'};">${cellContent}</td>`;
          }).join('');

          return `<tr>${cells}</tr>`;
        }).join('');

        let extraRowsHtml = '';
        if (section.tableRows && section.tableRows.length > sortedDuties.length) {
          extraRowsHtml = section.tableRows.slice(sortedDuties.length).map((r) => {
            const cells = headersList.map((_, cIdx) => {
              const val = r[cIdx] || '';
              return `<td style="border: 1px solid ${lineColor}25; padding: ${isSub ? '6px 8px' : '7px 10px'}; font-size: ${isSub ? '9pt' : '9.5pt'}; color: ${textColor};">${replaceDocumentTags(val, staff, companyName, effectiveDate)}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
          }).join('');
        }

        const introHtml = section.text
          ? `<p style="font-size: ${isSub ? '9.5pt' : '10pt'}; color: ${textColor}; line-height: 1.6; margin: 6px 0;">${replaceDocumentTags(section.text, staff, companyName, effectiveDate)}</p>`
          : '';

        return `
          ${introHtml}
          <div style="width: 100%; overflow-x: auto; margin: 10px 0;">
            <table style="width: 100%; min-width: 550px; border-collapse: collapse; font-family: inherit;">
              <thead><tr>${headerHtml}</tr></thead>
              <tbody>${dutyRowsHtml}${extraRowsHtml}</tbody>
            </table>
          </div>
        `;
      };

      let body = '';
      if (sec.type === 'text') {
        body = `<p style="font-size: 10.5pt; color: ${textColor}; line-height: 1.6; margin: 8px 0;">${replaceDocumentTags(sec.text || '', staff, companyName, effectiveDate)}</p>`;
      } else if (sec.type === 'duties_list' || sec.type === 'all_roles' || sec.type === 'key_roles' || sec.type === 'normal_roles' || sec.type === 'skills') {
        body = renderRoleHtml(sec.type, sec.text);
      } else if (sec.type === 'jd_targets_table') {
        body = renderJdTargetsTableHtml(sec, false);
      } else if (sec.type === 'list') {
        const headingHtml = sec.heading ? `<p style="font-size: 10.5pt; font-weight: 600; color: ${textColor}; margin: 6px 0;">${replaceDocumentTags(sec.heading, staff, companyName, effectiveDate)}</p>` : '';
        const itemsHtml = (sec.listItems && sec.listItems.length > 0 ? sec.listItems : ['Execute assigned responsibilities'])
          .map((item, itemIdx) => {
            const itemPrefix = getListPrefix(itemIdx, sec.listEnumeration || 'dots');
            return `<li style="margin-bottom: 4px; list-style: none;"><strong style="color: ${lineColor}; margin-right: 6px;">${itemPrefix}</strong>${replaceDocumentTags(item, staff, companyName, effectiveDate)}</li>`;
          })
          .join('');
        body = `${headingHtml}<ul style="padding-left: 8px; font-size: 10.5pt; color: ${textColor}; line-height: 1.6; margin: 6px 0;">${itemsHtml}</ul>`;
      } else if (sec.type === 'table') {
        const headers = (sec.tableHeaders || ['Operational Parameter', 'Designated Specification & Value'])
          .map((h) => `<th style="border: 1px solid ${lineColor}40; background: ${lineColor}15; padding: 7px 10px; text-align: left; font-size: 10pt; color: ${textColor}; font-weight: 700;">${replaceDocumentTags(h, staff, companyName, effectiveDate)}</th>`)
          .join('');

        const rows = (sec.tableRows || [])
          .map((row) => {
            const cells = row.map((c) => `<td style="border: 1px solid ${lineColor}25; padding: 7px 10px; font-size: 10pt; color: ${textColor};">${replaceDocumentTags(c, staff, companyName, effectiveDate)}</td>`).join('');
            return `<tr>${cells}</tr>`;
          })
          .join('');

        body = `
          <div style="width: 100%; overflow-x: auto; margin: 12px 0;">
            <table style="width: 100%; min-width: 480px; border-collapse: collapse; font-family: inherit;">
              <thead><tr>${headers}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      }

      // Subsections
      const subsectionsHtml = (sec.subsections || []).map((sub, subIdx) => {
        const subPrefix = getPrefix(subIdx, sub.enumeration, true);
        const subTitle = subPrefix + replaceDocumentTags(sub.title, staff, companyName, effectiveDate);
        let subBody = '';
        if (sub.type === 'text') {
          subBody = `<p style="font-size: 10pt; color: ${textColor}; line-height: 1.55; margin: 5px 0;">${replaceDocumentTags(sub.text || '', staff, companyName, effectiveDate)}</p>`;
        } else if (sub.type === 'list') {
          const headingHtml = sub.heading ? `<p style="font-size: 10pt; font-weight: 600; color: ${textColor}; margin: 4px 0;">${replaceDocumentTags(sub.heading, staff, companyName, effectiveDate)}</p>` : '';
          const itemsHtml = (sub.listItems && sub.listItems.length > 0 ? sub.listItems : ['Execute assigned responsibilities under this clause'])
            .map((item, itemIdx) => {
              const itemPrefix = getListPrefix(itemIdx, sub.listEnumeration || 'dots');
              return `<li style="margin-bottom: 4px; list-style: none;"><strong style="color: ${lineColor}; margin-right: 6px;">${itemPrefix}</strong>${replaceDocumentTags(item, staff, companyName, effectiveDate)}</li>`;
            })
            .join('');
          subBody = `${headingHtml}<ul style="padding-left: 8px; font-size: 10pt; color: ${textColor}; line-height: 1.55; margin: 5px 0;">${itemsHtml}</ul>`;
        } else if (sub.type === 'duties_list' || sub.type === 'all_roles' || sub.type === 'key_roles' || sub.type === 'normal_roles' || sub.type === 'skills') {
          subBody = renderRoleHtml(sub.type, sub.text, true);
        } else if (sub.type === 'jd_targets_table') {
          subBody = renderJdTargetsTableHtml(sub, true);
        } else if (sub.type === 'table') {
          const subHeaders = (sub.tableHeaders || ['Item', 'Target']).map((h) => `<th style="border: 1px solid ${lineColor}30; background: ${lineColor}10; padding: 6px 8px; font-size: 9.5pt; color: ${textColor}; font-weight: bold;">${replaceDocumentTags(h, staff, companyName, effectiveDate)}</th>`).join('');
          const subRows = (sub.tableRows || []).map((r) => `<tr>${r.map((c) => `<td style="border: 1px solid ${lineColor}20; padding: 6px 8px; font-size: 9.5pt; color: ${textColor};">${replaceDocumentTags(c, staff, companyName, effectiveDate)}</td>`).join('')}</tr>`).join('');
          subBody = `<div style="width: 100%; overflow-x: auto; margin: 8px 0;"><table style="width: 100%; min-width: 440px; border-collapse: collapse;"><thead><tr>${subHeaders}</tr></thead><tbody>${subRows}</tbody></table></div>`;
        }

        return `
          <div style="margin-left: 16px; margin-top: 10px;">
            <div style="font-weight: 700; font-size: 10pt; color: ${textColor};">${subTitle}</div>
            ${subBody}
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 20px;">
          <div style="font-weight: 800; font-size: 11pt; color: ${lineColor}; text-transform: uppercase; border-bottom: 1.5px solid ${lineColor}; padding-bottom: 4px; margin-bottom: 8px;">
            ${title}
          </div>
          ${body}
          ${subsectionsHtml}
        </div>
      `;
    }).join('');

    const logoHtml = logo
      ? `<div style="text-align: center; margin-bottom: 12px;"><img src="${logo}" alt="Logo" style="max-height: 70px; max-width: 220px; object-fit: contain; margin: 0 auto;" /></div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${config.typeLabel} - ${staff.name}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body {
              font-family: 'Segoe UI', Calibri, Arial, sans-serif;
              color: ${textColor};
              background: #fff;
              line-height: 1.6;
              padding: 20px;
              margin: 0;
            }
            .header-box {
              border-bottom: 2px dashed ${lineColor};
              padding-bottom: 14px;
              margin-bottom: 22px;
              text-align: center;
            }
            .company-name {
              font-size: 16pt;
              font-weight: 800;
              color: ${lineColor};
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .doc-title {
              font-size: 12.5pt;
              font-weight: 700;
              color: ${textColor};
              margin-top: 5px;
              letter-spacing: 0.5px;
            }
            .meta-grid {
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
              color: #64748b;
              margin-bottom: 20px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 8px;
            }
            .sig-grid {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              padding-top: 15px;
              border-top: 1px solid #cbd5e1;
            }
            .sig-block {
              width: 45%;
              font-size: 9.5pt;
            }
            .sig-line {
              border-top: 1.5px solid ${lineColor};
              margin-top: 35px;
              padding-top: 5px;
              font-weight: 700;
              color: ${textColor};
            }
          </style>
        </head>
        <body>
          <div class="header-box">
            ${logoHtml}
            <div class="company-name">${companyName}</div>
            <div class="doc-title">${config.title}</div>
          </div>

          <div class="meta-grid">
            <div>
              ${(config.headerMeta?.leftItems || []).map(item => `<div><strong>${item.label}:</strong> ${replaceDocumentTags(item.value, staff, companyName, effectiveDate)}</div>`).join('')}
            </div>
            <div style="text-align: right;">
              ${(config.headerMeta?.rightItems || []).map(item => `<div><strong>${item.label}:</strong> ${replaceDocumentTags(item.value, staff, companyName, effectiveDate)}</div>`).join('')}
            </div>
          </div>

          ${renderedSections}

          <div class="sig-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 40px; padding-top: 15px; border-top: 1px solid #cbd5e1;">
            ${(config.signatures?.signatures || [
              { id: 'sig-1', title: config.hrSig, subtitle: 'Date: ____ / ____ / ________' },
              { id: 'sig-2', title: config.empSig, subtitle: 'Date: ____ / ____ / ________' },
            ]).map((sig) => {
              return `
                <div class="sig-block" style="min-width: 160px; font-size: 9.5pt;">
                  <div class="sig-line" style="border-top: 1.5px solid ${lineColor}; margin-top: 25px; padding-top: 5px; font-weight: 700; color: ${textColor};">
                    ${replaceDocumentTags(sig.title, staff, companyName, effectiveDate)}
                  </div>
                  <div style="color: #64748b; font-size: 8.5pt; margin-top: 3px;">
                    ${sig.subtitle ? replaceDocumentTags(sig.subtitle, staff, companyName, effectiveDate) : 'Date: ____ / ____ / ________'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </body>
      </html>
    `;
  };

  // Browser Print
  const handlePrint = () => {
    if (!activeTab) return;
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(generateDocHtml());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Download Microsoft Word .doc Document
  const handleExportDoc = () => {
    if (!activeTab) return;
    const htmlContent = generateDocHtml();
    const source = `data:application/vnd.ms-word;charset=utf-8,${encodeURIComponent(htmlContent)}`;
    const fileDownload = document.createElement('a');
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${staff.name.replace(/\s+/g, '_')}_${docConfig.typeLabel.replace(/\s+/g, '_')}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const renderJdTargetsTablePreview = (section: DocumentSection, isSub = false) => {
    const dutyFilter = section.dutyFilter || 'all';
    let duties = roleDuties.items;
    if (dutyFilter === 'key') {
      duties = (roleDuties.keyItems && roleDuties.keyItems.length > 0)
        ? roleDuties.keyItems
        : roleDuties.items.filter((i) => i.isKey);
    } else if (dutyFilter === 'normal') {
      duties = (roleDuties.normalItems && roleDuties.normalItems.length > 0)
        ? roleDuties.normalItems
        : roleDuties.items.filter((i) => !i.isKey);
    }

    if (duties.length === 0) {
      duties = [
        {
          id: 'prev-1',
          text: 'Direct operational workflows, key milestones, and team deliverables',
          target: roleDuties.targets || 'Achieve ≥98% fulfillment benchmark with zero quality breaches',
          weight: 40,
          isKey: true,
        },
        {
          id: 'prev-2',
          text: 'Enforce stringent quality benchmarks, compliance protocols, and safety standards',
          target: roleDuties.targets || '100% compliance across quarterly audit checkpoints',
          weight: 35,
          isKey: true,
        },
        {
          id: 'prev-3',
          text: 'Coordinate daily departmental handovers and routine operational logs',
          target: roleDuties.targets || 'Daily handover logs submitted accurately on time',
          weight: 25,
          isKey: false,
        },
      ];
    }

    const sortedDuties = [...duties];
    if (section.sortByWeight !== false) {
      sortedDuties.sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
    }

    const headersList = (section.tableHeaders && section.tableHeaders.length > 0)
      ? section.tableHeaders
      : [
          'Job Description / Operational Duty',
          'Target / Performance Standard',
          'Weight (%)',
          'Self Rating (1-5)',
          'Supervisor Score (1-5)',
          'Achievement & Remarks',
        ];

    return (
      <div className="space-y-2 my-2">
        {section.text && (
          <p className="leading-relaxed text-[11px]" style={{ color: textColor }}>
            {replaceDocumentTags(section.text, staff, companyName, effectiveDate)}
          </p>
        )}
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
          <table className="w-full min-w-[550px] border-collapse text-[10.5px]">
            <thead>
              <tr style={{ backgroundColor: `${lineColor}15` }}>
                {headersList.map((h, i) => {
                  const isWeight = h.toLowerCase().includes('weight');
                  const isRating = h.toLowerCase().includes('rating') || h.toLowerCase().includes('score');
                  return (
                    <th
                      key={i}
                      className={`border p-2 font-bold ${isWeight || isRating ? 'text-center' : 'text-left'}`}
                      style={{ borderColor: `${lineColor}40`, color: textColor }}
                    >
                      {replaceDocumentTags(h, staff, companyName, effectiveDate)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedDuties.map((duty, dIdx) => {
                const customRow = section.tableRows && section.tableRows[dIdx] ? section.tableRows[dIdx] : [];
                return (
                  <tr key={duty.id || dIdx} className="border-b border-slate-200 hover:bg-slate-50/60 transition">
                    {headersList.map((header, cIdx) => {
                      const hLower = header.toLowerCase();
                      const isWeight = hLower.includes('weight');
                      const isRating = hLower.includes('rating') || hLower.includes('score');

                      let cellVal: React.ReactNode = '';
                      if (cIdx === 0) {
                        cellVal = (
                          <div className="space-y-0.5">
                            <span className="font-semibold" style={{ color: textColor }}>
                              {replaceDocumentTags(duty.text, staff, companyName, effectiveDate)}
                            </span>
                            {duty.isKey && (
                              <span
                                className="inline-block ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{ backgroundColor: `${lineColor}20`, color: lineColor }}
                              >
                                Key
                              </span>
                            )}
                          </div>
                        );
                      } else if (cIdx === 1) {
                        cellVal = (
                          <span className="font-medium text-slate-700">
                            {replaceDocumentTags(duty.target || roleDuties.targets || 'Achieve designated benchmark', staff, companyName, effectiveDate)}
                          </span>
                        );
                      } else if (cIdx === 2 || isWeight) {
                        const weightVal = duty.weight !== undefined ? duty.weight : (duty.isKey ? 25 : 15);
                        cellVal = (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full font-bold text-[10px]"
                            style={{ backgroundColor: `${lineColor}20`, color: lineColor }}
                          >
                            {weightVal}%
                          </span>
                        );
                      } else {
                        if (customRow[cIdx] !== undefined && customRow[cIdx].trim() !== '') {
                          cellVal = replaceDocumentTags(customRow[cIdx], staff, companyName, effectiveDate);
                        } else if (isRating) {
                          cellVal = <span className="font-mono text-slate-400 text-[10px]">[ &nbsp; &nbsp; ]</span>;
                        } else {
                          cellVal = <span className="text-slate-300 text-[10px]">—</span>;
                        }
                      }

                      return (
                        <td
                          key={cIdx}
                          className={`border p-2 ${isWeight || isRating ? 'text-center' : 'text-left'}`}
                          style={{ borderColor: `${lineColor}25` }}
                        >
                          {cellVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {(section.tableRows || []).slice(sortedDuties.length).map((row, rIdx) => (
                <tr key={`extra-${rIdx}`} className="border-b border-slate-200">
                  {headersList.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className="border p-2"
                      style={{ borderColor: `${lineColor}25`, color: textColor }}
                    >
                      {replaceDocumentTags(row[cIdx] || '', staff, companyName, effectiveDate)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white"
      >
        {/* Modal Top Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Staff Official Documentation Hub</h3>
                {isNewStaffPrompt && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                    New Employee Added
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Generate & print official contracts, job descriptions, and letters for{' '}
                <strong className="text-white">{staff.name}</strong> ({staff.department})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation: JD / Appraisal / Confirmation / Appointment */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800 bg-slate-900/60">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('jd')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'jd'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Job Description (JD)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('appraisal')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'appraisal'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Appraisal & KPI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('confirmation')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'confirmation'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Confirmation Letter</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('appointment')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'appointment'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Appointment Letter</span>
            </button>
          </div>
        </div>

        {/* Modal Main Body: Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60">
          {!activeTab ? (
            <div className="p-12 text-center border border-dashed rounded-3xl border-slate-800 space-y-3 bg-slate-900/40">
              <FileText className="w-12 h-12 text-slate-500 mx-auto opacity-60" />
              <h4 className="text-base font-bold text-white">Select a Document Tab Above to Preview</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Click either <strong>Job Description (JD)</strong>, <strong>Confirmation Letter</strong>, or <strong>Appointment Letter</strong> to view its live customized letterhead preview. Once selected, you can print or export to Word (.doc), or click <strong>Finish</strong> to continue.
              </p>
            </div>
          ) : (
            <div
              className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 text-xs font-sans space-y-6 max-w-3xl mx-auto border border-slate-200"
              style={{ color: textColor }}
            >
              {/* Top Centered Logo */}
              {logo && (
                <div className="flex items-center justify-center pb-2 text-center">
                  <img
                    src={logo}
                    alt="Company Logo"
                    className="max-h-16 max-w-[220px] object-contain mx-auto"
                  />
                </div>
              )}

              {/* Paper Letterhead */}
              <div
                className="text-center pb-4 space-y-1"
                style={{ borderBottom: `2px dashed ${lineColor}` }}
              >
                <div
                  className="font-black uppercase tracking-widest text-base sm:text-lg"
                  style={{ color: lineColor }}
                >
                  {companyName}
                </div>
                <div
                  className="font-bold text-xs sm:text-sm uppercase tracking-wider"
                  style={{ color: textColor }}
                >
                  {docConfig.title}
                </div>
                <div className="text-[10px] font-mono text-slate-500 pt-1">
                  Human Resources & Personnel Management Division
                </div>
              </div>

              {/* Metadata Bar / Head of Letter */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 text-[10px] font-mono text-slate-500 border-b border-slate-200 pb-2.5">
                <div className="space-y-0.5">
                  {(docConfig.headerMeta?.leftItems || []).map((item) => (
                    <div key={item.id} className="leading-tight">
                      <span className="text-slate-600 font-semibold">{item.label}:</span>{' '}
                      <span className="text-slate-500">
                        {replaceDocumentTags(item.value, staff, companyName, effectiveDate)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="sm:text-right space-y-0.5 font-mono text-slate-500">
                  {(docConfig.headerMeta?.rightItems || []).map((item) => (
                    <div key={item.id} className="leading-tight">
                      <span className="text-slate-600 font-semibold">{item.label}:</span>{' '}
                      <span className="text-slate-500">
                        {replaceDocumentTags(item.value, staff, companyName, effectiveDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rendered Document Sections */}
              <div className="space-y-5 leading-relaxed text-[11.5px]" style={{ color: textColor }}>
                {docConfig.sections.map((sec, secIdx) => {
                  const secPrefix = getPrefix(secIdx, sec.enumeration, false);
                  const title = secPrefix + replaceDocumentTags(sec.title, staff, companyName, effectiveDate);

                  return (
                    <div key={sec.id || secIdx} className="space-y-2">
                      <div
                        className="font-bold uppercase tracking-wider text-xs pb-1"
                        style={{
                          color: lineColor,
                          borderBottom: `1px solid ${lineColor}40`,
                        }}
                      >
                        {title}
                      </div>

                      {sec.type === 'text' && (
                        <p className="leading-relaxed" style={{ color: textColor }}>
                          {replaceDocumentTags(sec.text || '', staff, companyName, effectiveDate)}
                        </p>
                      )}

                      {(sec.type === 'duties_list' || sec.type === 'all_roles' || sec.type === 'key_roles' || sec.type === 'normal_roles' || sec.type === 'skills') && (
                        <div className="space-y-1.5">
                          {sec.text && (
                            <p className="leading-relaxed" style={{ color: textColor }}>
                              {replaceDocumentTags(sec.text, staff, companyName, effectiveDate)}
                            </p>
                          )}
                          {sec.type === 'skills' ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {((roleDuties.skills && roleDuties.skills.length > 0)
                                ? roleDuties.skills
                                : ['Operational Workflow Management', 'Quality Benchmark Compliance', 'Process Optimization', 'Safety Protocols']
                              ).map((skill, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                                  style={{
                                    backgroundColor: `${lineColor}15`,
                                    borderColor: `${lineColor}35`,
                                    color: textColor
                                  }}
                                >
                                  {replaceDocumentTags(skill, staff, companyName, effectiveDate)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <ul className="list-disc list-inside pl-2 space-y-1 font-medium" style={{ color: textColor }}>
                              {(() => {
                                let itemsToRender = roleDuties.items;
                                if (sec.type === 'key_roles') {
                                  itemsToRender = (roleDuties.keyItems && roleDuties.keyItems.length > 0)
                                    ? roleDuties.keyItems
                                    : roleDuties.items.filter((i) => i.isKey);
                                } else if (sec.type === 'normal_roles') {
                                  itemsToRender = (roleDuties.normalItems && roleDuties.normalItems.length > 0)
                                    ? roleDuties.normalItems
                                    : roleDuties.items.filter((i) => !i.isKey);
                                }
                                if (itemsToRender.length === 0) {
                                  if (sec.type === 'key_roles') {
                                    itemsToRender = [
                                      { id: 'fb-k1', text: 'Direct operational workflows, key milestones, and deliverables', isKey: true },
                                      { id: 'fb-k2', text: 'Enforce stringent quality benchmarks and compliance protocols', isKey: true },
                                    ];
                                  } else if (sec.type === 'normal_roles') {
                                    itemsToRender = [
                                      { id: 'fb-n1', text: 'Coordinate daily departmental handovers and routine tasks', isKey: false },
                                      { id: 'fb-n2', text: 'Maintain operating records and standard routine logs', isKey: false },
                                    ];
                                  } else {
                                    itemsToRender = [
                                      { id: 'fb-a1', text: 'Manage daily operational workflows and department deliverables', isKey: false },
                                      { id: 'fb-a2', text: 'Ensure strict compliance with punctuality, shift rosters, and safety procedures', isKey: false },
                                      { id: 'fb-a3', text: 'Maintain quality standards and execute monthly performance targets', isKey: false },
                                    ];
                                  }
                                }
                                return itemsToRender.map((it, idx) => (
                                  <li key={idx}>
                                    {replaceDocumentTags(it.text, staff, companyName, effectiveDate)}
                                  </li>
                                ));
                              })()}
                            </ul>
                          )}
                        </div>
                      )}

                      {sec.type === 'list' && (
                        <div className="space-y-1">
                          {sec.heading && (
                            <p className="font-semibold text-[11px]" style={{ color: textColor }}>
                              {replaceDocumentTags(sec.heading, staff, companyName, effectiveDate)}
                            </p>
                          )}
                          <ul className="space-y-1 pl-1 text-[11px]" style={{ color: textColor }}>
                            {(sec.listItems && sec.listItems.length > 0 ? sec.listItems : ['Execute assigned responsibilities']).map((item, itemIdx) => {
                              const itemPrefix = getListPrefix(itemIdx, sec.listEnumeration || 'dots');
                              return (
                                <li key={itemIdx} className="flex items-start gap-1.5">
                                  <span className="font-bold shrink-0" style={{ color: lineColor }}>{itemPrefix}</span>
                                  <span>{replaceDocumentTags(item, staff, companyName, effectiveDate)}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {sec.type === 'jd_targets_table' && renderJdTargetsTablePreview(sec, false)}

                      {sec.type === 'table' && (
                        <div className="w-full overflow-x-auto my-2 rounded-xl border border-slate-200 shadow-2xs">
                          <table className="w-full min-w-[480px] border-collapse text-[10.5px]">
                            <thead>
                              <tr style={{ backgroundColor: `${lineColor}15` }}>
                                {(sec.tableHeaders || ['Operational Parameter', 'Designated Specification & Value']).map((h, i) => (
                                  <th
                                    key={i}
                                    className="border p-2 text-left font-bold"
                                    style={{ borderColor: `${lineColor}40`, color: textColor }}
                                  >
                                    {replaceDocumentTags(h, staff, companyName, effectiveDate)}
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
                                      className="border p-2 font-medium"
                                      style={{ borderColor: `${lineColor}25`, color: textColor }}
                                    >
                                      {replaceDocumentTags(cell, staff, companyName, effectiveDate)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Subsections */}
                      {(sec.subsections || []).map((sub, subIdx) => {
                        const subPrefix = getPrefix(subIdx, sub.enumeration, true);
                        const subTitle = subPrefix + replaceDocumentTags(sub.title, staff, companyName, effectiveDate);

                        return (
                          <div key={sub.id || subIdx} className="pl-4 space-y-1.5 border-l-2 border-slate-200 mt-2">
                            <div className="font-bold text-[11px]" style={{ color: textColor }}>
                              {subTitle}
                            </div>
                            {sub.type === 'text' && (
                              <p className="leading-relaxed text-[11px] opacity-80" style={{ color: textColor }}>
                                {replaceDocumentTags(sub.text || '', staff, companyName, effectiveDate)}
                              </p>
                            )}
                            {sub.type === 'list' && (
                              <div className="space-y-1 text-[11px]">
                                {sub.heading && (
                                  <p className="font-semibold text-[10.5px]" style={{ color: textColor }}>
                                    {replaceDocumentTags(sub.heading, staff, companyName, effectiveDate)}
                                  </p>
                                )}
                                <ul className="space-y-0.5 pl-1 text-[10.5px]" style={{ color: textColor }}>
                                  {(sub.listItems && sub.listItems.length > 0 ? sub.listItems : ['Execute assigned responsibilities under this clause']).map((item, itemIdx) => {
                                    const itemPrefix = getListPrefix(itemIdx, sub.listEnumeration || 'dots');
                                    return (
                                      <li key={itemIdx} className="flex items-start gap-1">
                                        <span className="font-bold shrink-0">{itemPrefix}</span>
                                        <span>{replaceDocumentTags(item, staff, companyName, effectiveDate)}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {(sub.type === 'duties_list' || sub.type === 'all_roles' || sub.type === 'key_roles' || sub.type === 'normal_roles' || sub.type === 'skills') && (
                              <div className="space-y-1 text-[11px]">
                                {sub.text && (
                                  <p className="opacity-80" style={{ color: textColor }}>
                                    {replaceDocumentTags(sub.text, staff, companyName, effectiveDate)}
                                  </p>
                                )}
                                {sub.type === 'skills' ? (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {((roleDuties.skills && roleDuties.skills.length > 0)
                                      ? roleDuties.skills
                                      : ['Operational Workflow Management', 'Quality Benchmark Compliance', 'Process Optimization', 'Safety Protocols']
                                    ).map((skill, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                                        style={{
                                          backgroundColor: `${lineColor}15`,
                                          borderColor: `${lineColor}30`,
                                          color: textColor
                                        }}
                                      >
                                        {replaceDocumentTags(skill, staff, companyName, effectiveDate)}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <ul className="list-disc list-inside pl-2 space-y-0.5" style={{ color: textColor }}>
                                    {(() => {
                                      let subItems = roleDuties.items;
                                      if (sub.type === 'key_roles') {
                                        subItems = (roleDuties.keyItems && roleDuties.keyItems.length > 0)
                                          ? roleDuties.keyItems
                                          : roleDuties.items.filter((i) => i.isKey);
                                      } else if (sub.type === 'normal_roles') {
                                        subItems = (roleDuties.normalItems && roleDuties.normalItems.length > 0)
                                          ? roleDuties.normalItems
                                          : roleDuties.items.filter((i) => !i.isKey);
                                      }
                                      if (subItems.length === 0) {
                                        if (sub.type === 'key_roles') {
                                          subItems = [
                                            { id: 'sub-k1', text: 'Direct operational workflows and key milestones', isKey: true },
                                            { id: 'sub-k2', text: 'Enforce stringent quality benchmarks and safety protocols', isKey: true },
                                          ];
                                        } else if (sub.type === 'normal_roles') {
                                          subItems = [
                                            { id: 'sub-n1', text: 'Coordinate daily departmental handovers and routine tasks', isKey: false },
                                            { id: 'sub-n2', text: 'Maintain operating records and standard routine logs', isKey: false },
                                          ];
                                        } else {
                                          subItems = [
                                            { id: 'sub-a1', text: 'Execute specific assigned duties and protocols', isKey: false },
                                            { id: 'sub-a2', text: 'Coordinate with team leadership on daily handovers', isKey: false },
                                          ];
                                        }
                                      }
                                      return subItems.map((it, idx) => (
                                        <li key={idx}>
                                          {replaceDocumentTags(it.text, staff, companyName, effectiveDate)}
                                        </li>
                                      ));
                                    })()}
                                  </ul>
                                )}
                              </div>
                            )}
                            {sub.type === 'jd_targets_table' && renderJdTargetsTablePreview(sub, true)}
                            {sub.type === 'table' && (
                              <div className="w-full overflow-x-auto my-1 rounded-lg border border-slate-200 shadow-2xs">
                                <table className="w-full min-w-[440px] border-collapse text-[10px]">
                                  <thead>
                                    <tr className="bg-slate-100">
                                      {(sub.tableHeaders || ['Item', 'Target']).map((h, i) => (
                                        <th key={i} className="border border-slate-300 p-1.5 text-left font-bold" style={{ color: textColor }}>
                                          {replaceDocumentTags(h, staff, companyName, effectiveDate)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(sub.tableRows || []).map((r, rIdx) => (
                                      <tr key={rIdx}>
                                        {r.map((c, cIdx) => (
                                          <td key={cIdx} className="border border-slate-300 p-1.5" style={{ color: textColor }}>
                                            {replaceDocumentTags(c, staff, companyName, effectiveDate)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Signatures Dynamic Grid (2D Grid: 2 Columns, N Rows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-slate-300 text-[11px] text-slate-700">
                {(docConfig.signatures?.signatures || [
                  { id: 'sig-1', title: docConfig.hrSig, subtitle: 'Date: ____ / ____ / ________' },
                  { id: 'sig-2', title: docConfig.empSig, subtitle: 'Date: ____ / ____ / ________' },
                ]).map((sig, sIdx) => (
                  <div key={sig.id || sIdx} className="space-y-2">
                    <div
                      className="pt-1.5 font-bold"
                      style={{ borderTop: `1.5px solid ${lineColor}`, color: textColor }}
                    >
                      {replaceDocumentTags(sig.title, staff, companyName, effectiveDate)}
                    </div>
                    <div className="text-slate-500 font-mono text-[10px]">
                      {sig.subtitle ? replaceDocumentTags(sig.subtitle, staff, companyName, effectiveDate) : 'Date: ____ / ____ / ________'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            {activeTab ? (
              <span className="text-teal-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <span>Ready to Print / Export: <strong>{docConfig.typeLabel}</strong></span>
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5">
                <span>Select a tab above to activate Print & Export actions</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!activeTab}
              onClick={handleExportDoc}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                !activeTab
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-600 text-white shadow-md shadow-blue-700/20 cursor-pointer'
              }`}
              title="Download Microsoft Word (.doc) formatted letterhead"
            >
              <Download className="w-4 h-4 text-blue-200" />
              <span>Download (.doc)</span>
            </button>

            <button
              type="button"
              disabled={!activeTab}
              onClick={handlePrint}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                !activeTab
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/30 cursor-pointer'
              }`}
              title="Open Browser Print Dialog"
            >
              <Printer className="w-4 h-4 text-teal-100" />
              <span>Print</span>
            </button>

            {/* Finish Button which bypasses printing */}
            <button
              type="button"
              onClick={handleFinishAction}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              title="Complete registration and bypass printing"
            >
              <Check className="w-4 h-4" />
              <span>Finish</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
