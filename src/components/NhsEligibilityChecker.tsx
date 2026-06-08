"use client";

import { useState } from "react";
import { NHS_RX_CHARGE, PPC_ANNUAL, PPC_3MONTH } from "@/lib/config";
import { formatGBP } from "@/lib/format-utils";

interface NhsEligibilityCheckerProps {
  medicineId: number;
  medicineName: string;
  retailPrice: number | null;
}

export default function NhsEligibilityChecker({ medicineName, retailPrice }: NhsEligibilityCheckerProps) {
  const [expanded, setExpanded] = useState(false);
  const [answers, setAnswers] = useState({
    age: "",
    benefits: false,
    maternity: false,
    medical: false,
    lowIncome: false,
    location: "england",
  });

  const ageNum = parseInt(answers.age, 10);
  const possibleHelp = (
    (!Number.isNaN(ageNum) && (ageNum < 16 || ageNum >= 60)) ||
    answers.benefits ||
    answers.maternity ||
    answers.medical ||
    answers.lowIncome ||
    answers.location !== "england"
  );

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
          Check NHS prescription cost guidance
        </div>
      </button>
    );
  }

  return (
    <div className="mt-5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="font-bold text-[var(--color-foreground)] text-base">NHS prescription cost guidance</h3>
        <button
          onClick={() => setExpanded(false)}
          className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label="Close eligibility guidance"
        >
          x
        </button>
      </div>

      <p className="text-sm text-[var(--color-muted)] mb-5">
        This quick guide cannot decide eligibility. NHS help depends on age, income, where you live, benefits, pregnancy, medical exemption certificates and low-income certificates.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <label className="block">
          <span className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Your age</span>
          <input
            type="number"
            min="0"
            max="150"
            value={answers.age}
            onChange={e => setAnswers(v => ({ ...v, age: e.target.value }))}
            placeholder="e.g. 35"
            className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-[var(--color-foreground)] mb-2">Where do you live?</span>
          <select
            value={answers.location}
            onChange={e => setAnswers(v => ({ ...v, location: e.target.value }))}
            className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 bg-[var(--color-surface)] text-[var(--color-foreground)] focus:outline-none focus:border-[var(--color-brand)]"
          >
            <option value="england">England</option>
            <option value="scotland">Scotland</option>
            <option value="wales">Wales</option>
            <option value="northern-ireland">Northern Ireland</option>
          </select>
        </label>
      </div>

      <div className="space-y-2 mb-5">
        {[
          ["benefits", "I receive qualifying benefits or tax credits"],
          ["maternity", "I am pregnant or gave birth in the last 12 months"],
          ["medical", "I have a medical exemption certificate or qualifying condition"],
          ["lowIncome", "I have, or may qualify for, an NHS low income certificate"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={answers[key as keyof typeof answers] as boolean}
              onChange={e => setAnswers(v => ({ ...v, [key]: e.target.checked }))}
              className="w-4 h-4 mt-0.5 rounded border border-[var(--color-border)]"
            />
            <span className="text-sm text-[var(--color-foreground)]">{label}</span>
          </label>
        ))}
      </div>

      <div className={`rounded-2xl px-5 py-4 border ${possibleHelp ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"}`}>
        <p className={`font-bold mb-1 ${possibleHelp ? "text-green-800 dark:text-green-300" : "text-blue-800 dark:text-blue-300"}`}>
          {possibleHelp ? "You may be able to get help with prescription costs." : "You may pay the standard England prescription charge."}
        </p>
        <p className={`text-sm ${possibleHelp ? "text-green-700 dark:text-green-200" : "text-blue-700 dark:text-blue-200"}`}>
          In England, the standard prescription charge is {formatGBP(NHS_RX_CHARGE)} per item. A PPC costs {formatGBP(PPC_3MONTH)} for 3 months or {formatGBP(PPC_ANNUAL)} for 12 months.
          {retailPrice !== null ? ` The cheapest current retail price for ${medicineName} is ${formatGBP(retailPrice)}.` : ""}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="https://www.gov.uk/help-nhs-costs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          Check official eligibility
        </a>
        <a
          href="https://www.nhsbsa.nhs.uk/help-nhs-prescription-costs/nhs-prescription-prepayment-certificate-ppc"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          Learn about PPC
        </a>
      </div>
    </div>
  );
}
