'use client';

import { useState } from 'react';
import { formatGBP } from '@/lib/format-utils';

interface NhsEligibilityCheckerProps {
  medicineId: number;
  medicineName: string;
  retailPrice: number | null;
}

export default function NhsEligibilityChecker({ medicineId, medicineName, retailPrice }: NhsEligibilityCheckerProps) {
  const [expanded, setExpanded] = useState(false);
  const [age, setAge] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [hasDisability, setHasDisability] = useState(false);
  const [hasCheckedEligibility, setHasCheckedEligibility] = useState(false);

  const NHS_RX_CHARGE = 9.90;
  const PPC_ANNUAL = 111.60;

  const calculateEligibility = () => {
    const ageNum = parseInt(age, 10);

    // Determine if eligible for free prescriptions
    const isUnder16 = !isNaN(ageNum) && ageNum < 16;
    const isOver60 = !isNaN(ageNum) && ageNum >= 60;
    const isFreeEligible = isUnder16 || isOver60 || isStudent || isPregnant || hasDisability;

    return { isFreeEligible, ageNum };
  };

  const handleCheck = () => {
    setHasCheckedEligibility(true);
  };

  const { isFreeEligible, ageNum } = calculateEligibility();

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full mt-5 px-5 py-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left font-medium text-[var(--color-foreground)] hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Check if you get free prescriptions
        </div>
      </button>
    );
  }

  return (
    <div className="mt-5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[var(--color-foreground)] text-base flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--color-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Check Your Eligibility for Free Prescriptions
        </h3>
        <button
          onClick={() => {
            setExpanded(false);
            setHasCheckedEligibility(false);
          }}
          className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      <p className="text-sm text-[var(--color-muted)] mb-5">
        In the UK, some people get free NHS prescriptions. Answer a few questions to find out if you do.
      </p>

      {/* Form */}
      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Your age</label>
          <input
            type="number"
            min="0"
            max="150"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g., 35"
            className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-brand)]"
          />
          <p className="text-xs text-[var(--color-muted)] mt-1">Free if under 16 or over 60</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isStudent}
              onChange={(e) => setIsStudent(e.target.checked)}
              className="w-4 h-4 rounded border border-[var(--color-border)] text-[var(--color-brand)] focus:outline-none"
            />
            <span className="text-sm text-[var(--color-foreground)]">I'm a full-time student</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPregnant}
              onChange={(e) => setIsPregnant(e.target.checked)}
              className="w-4 h-4 rounded border border-[var(--color-border)] text-[var(--color-brand)] focus:outline-none"
            />
            <span className="text-sm text-[var(--color-foreground)]">I'm pregnant or recently gave birth (within last 12 months)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDisability}
              onChange={(e) => setHasDisability(e.target.checked)}
              className="w-4 h-4 rounded border border-[var(--color-border)] text-[var(--color-brand)] focus:outline-none"
            />
            <span className="text-sm text-[var(--color-foreground)]">I have a disability or chronic condition</span>
          </label>
        </div>
      </div>

      {/* Check button */}
      <button
        onClick={handleCheck}
        className="w-full px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
      >
        Check My Eligibility
      </button>

      {/* Results */}
      {hasCheckedEligibility && (
        <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
          {isFreeEligible ? (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl px-5 py-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="font-bold text-green-800 dark:text-green-300 mb-1">You qualify for free prescriptions!</p>
                  <p className="text-sm text-green-700 dark:text-green-200">
                    Each prescription is free instead of {formatGBP(String(NHS_RX_CHARGE))}. Save {formatGBP(String(NHS_RX_CHARGE))} per item.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-bold text-blue-800 dark:text-blue-300 mb-1">You pay the standard prescription charge</p>
                  <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                    Each prescription costs {formatGBP(String(NHS_RX_CHARGE))}. With {medicineName} at {retailPrice !== null ? formatGBP(String(retailPrice)) : 'N/A'}, you may save by buying over-the-counter instead.
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-200 mb-2">
                    If you take multiple medicines, consider a <strong>Prescription Prepayment Certificate</strong> at {formatGBP(String(PPC_ANNUAL))}/year for unlimited prescriptions.
                  </p>
                  <a href="https://www.nhsbsa.nhs.uk/help-nhs-prescription-costs/prescription-prepayment-certificates-ppcs" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline">
                    Learn about PPC →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
