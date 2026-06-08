import type { IngredientRow, MedicineRow } from "@/lib/medicines-dal";

interface Props {
  medicine: MedicineRow;
  ingredients: IngredientRow[];
}

export default function GenericEquivalence({ medicine, ingredients }: Props) {
  if (medicine.category !== "medicine") return null;

  const activeIngredients = ingredients.filter(i => i.is_active);
  const ingredientText = activeIngredients.length
    ? activeIngredients.map(i => i.quantity ? `${i.ingredient_name} ${i.quantity}` : i.ingredient_name).join(", ")
    : medicine.active_ingredient || medicine.generic_name || "the listed active ingredient";

  return (
    <section className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 mb-5">
      <h2 className="font-bold text-[var(--color-foreground)] text-base mb-2">Generic equivalence check</h2>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        Generic alternatives can be cheaper when they use the same active ingredient, strength and form under a different brand name. For this product, compare alternatives against: <strong className="text-[var(--color-foreground)]">{ingredientText}</strong>{medicine.dosage_form ? `, ${medicine.dosage_form}` : ""}.
      </p>
      <p className="text-xs text-[var(--color-muted)] mt-3">
        This is a comparison guide, not medical advice. Confirm suitability with a pharmacist or GP, especially for prescription medicines.
      </p>
    </section>
  );
}
