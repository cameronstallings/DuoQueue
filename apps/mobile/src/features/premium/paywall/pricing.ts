/**
 * DuoQueue+ plan maths and wording for the paywall's plans page. Pure (no React Native,
 * relative imports only), so vitest checks every number and sentence the purchase page shows.
 * The shapes below are the parts of react-native-purchases' PurchasesPackage this file reads; a
 * real package satisfies them structurally.
 */

export interface PlanIntroPrice {
  price: number;
  periodUnit: string;
  periodNumberOfUnits: number;
}

export interface PlanProduct {
  identifier: string;
  price: number;
  priceString: string;
  currencyCode: string;
  introPrice: PlanIntroPrice | null;
}

export interface PlanPackage {
  identifier: string;
  packageType: string;
  product: PlanProduct;
}

export type PlanPeriod = "week" | "month" | "threeMonths" | "sixMonths";

/** Shortest first: the order the rows are drawn in (all four stay reachable, Guideline 2.1(b)). */
export const PLAN_ORDER: readonly PlanPeriod[] = ["week", "month", "threeMonths", "sixMonths"];

/** Weeks in each billing period. A month is 52/12 weeks, never 4, so a plan's per-week price
 * and its saving against Weekly come from the same arithmetic. */
export const WEEKS_PER_PERIOD: Record<PlanPeriod, number> = { week: 1, month: 52 / 12, threeMonths: 13, sixMonths: 26 };

/** RevenueCat's INTRO_ELIGIBILITY_STATUS_ELIGIBLE. Unknown (0), ineligible (1) and "no intro
 * offer" (3) all mean no trial is shown. */
export const INTRO_ELIGIBLE = 2;

const PACKAGE_TYPE_PERIOD: Record<string, PlanPeriod> = {
  WEEKLY: "week",
  MONTHLY: "month",
  THREE_MONTH: "threeMonths",
  SIX_MONTH: "sixMonths",
};

/** The product ids in App Store Connect (docs/APP-STORE-SUBMISSION.md Part 2.5). */
const PRODUCT_ID_PERIOD: Record<string, PlanPeriod> = {
  duoqueue_plus_weekly: "week",
  duoqueue_plus_monthly: "month",
  duoqueue_plus_3mo: "threeMonths",
  duoqueue_plus_6mo: "sixMonths",
};

/**
 * RevenueCat's package type first, then our own product id, then null. Never a guess: a wrong
 * period on a row ("Monthly · $29.99") is a refund, a review and a 3.1.2 rejection.
 */
export function planPeriodOf(pkg: Pick<PlanPackage, "packageType" | "product">): PlanPeriod | null {
  return PACKAGE_TYPE_PERIOD[pkg.packageType] ?? PRODUCT_ID_PERIOD[pkg.product.identifier] ?? null;
}

export interface Plan<P extends PlanPackage = PlanPackage> {
  pkg: P;
  period: PlanPeriod;
}

/** The store's packages as plans, shortest first; empty slots, unknown products and a second
 * package for the same period are dropped. */
export function orderPlans<P extends PlanPackage>(pkgs: readonly (P | null | undefined)[]): Plan<P>[] {
  const byPeriod = new Map<PlanPeriod, Plan<P>>();
  for (const pkg of pkgs) {
    if (!pkg) continue;
    const period = planPeriodOf(pkg);
    if (period && !byPeriod.has(period)) byPeriod.set(period, { pkg, period });
  }
  return PLAN_ORDER.flatMap((period) => {
    const plan = byPeriod.get(period);
    return plan ? [plan] : [];
  });
}

/** The picked plan, else Monthly (the default, with no badge), else the first. */
export function selectedPlan<P extends PlanPackage>(plans: readonly Plan<P>[], selectedId: string | null): Plan<P> | null {
  return (
    plans.find((p) => p.pkg.identifier === selectedId) ?? plans.find((p) => p.period === "month") ?? plans[0] ?? null
  );
}

export function pricePerWeek(price: number, period: PlanPeriod): number {
  return price / WEEKS_PER_PERIOD[period];
}

/** A price in the store's currency; the code and two decimals if the platform cannot format it. */
export function formatMoney(amount: number, currencyCode: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Whole percent saved per week against the Weekly plan, rounded DOWN so it never claims more
 * than the store's prices give (76.9% reads "Save 76%"). Null for Weekly itself, without a
 * Weekly plan, or when there is no saving. The 1e-9 only stops floating-point noise turning an
 * exact whole saving (50%) into 49%; it is far below anything a price can express.
 */
export function savingsPercent(plan: Plan, weekly: Plan | null): number | null {
  if (plan.period === "week" || !weekly || weekly.pkg.product.price <= 0) return null;
  const saved = 1 - pricePerWeek(plan.pkg.product.price, plan.period) / weekly.pkg.product.price;
  const pct = Math.floor(saved * 100 + 1e-9);
  return pct > 0 ? pct : null;
}

const TRIAL_UNITS: Record<string, readonly [string, string]> = {
  DAY: ["day", "days"],
  WEEK: ["week", "weeks"],
  MONTH: ["month", "months"],
  YEAR: ["year", "years"],
};

/**
 * "7 days", "1 week": a trial to advertise, only for a FREE intro offer (price 0) that RevenueCat
 * says this Apple Account is still eligible for. Anything else is null, so a paid intro price or
 * an unknown eligibility never reads as free (build 17 fix: "Free trial included" showed for any
 * intro price).
 */
export function trialLength(intro: PlanIntroPrice | null, eligibility: number | undefined): string | null {
  if (!intro || intro.price !== 0 || eligibility !== INTRO_ELIGIBLE) return null;
  const unit = TRIAL_UNITS[intro.periodUnit];
  const n = intro.periodNumberOfUnits;
  if (!unit || n <= 0) return null;
  return `${n} ${n === 1 ? unit[0] : unit[1]}`;
}

export const PLAN_TITLES: Record<PlanPeriod, string> = {
  week: "Weekly",
  month: "Monthly",
  threeMonths: "3 Months",
  sixMonths: "6 Months",
};

/** The subscription names App Store Connect shows (Part 2.5), used in the renewal paragraph. */
export const PLAN_PRODUCT_NAMES: Record<PlanPeriod, string> = {
  week: "DuoQueue+ Weekly",
  month: "DuoQueue+ Monthly",
  threeMonths: "DuoQueue+ 3-Month",
  sixMonths: "DuoQueue+ 6-Month",
};

/** "$7.99 a month": what the button and the renewal paragraph say after the price. */
export const PERIOD_PHRASES: Record<PlanPeriod, string> = {
  week: "a week",
  month: "a month",
  threeMonths: "every 3 months",
  sixMonths: "every 6 months",
};

const BILLED_EVERY: Record<PlanPeriod, string> = {
  week: "every week",
  month: "every month",
  threeMonths: "every 3 months",
  sixMonths: "every 6 months",
};

export interface PlanCopy {
  title: string;
  /** The billed price: the largest price text on the row (Apple: "the amount that will be
   * billed must be the most prominent pricing element"). */
  price: string;
  /** Per-week price and period in smaller type, or the trial line. */
  subLine: string;
  saveChip: string | null;
  buttonLabel: string;
  /** Guideline 3.1.2 / Schedule 2, for this plan, placed directly under the button. */
  renewalText: string;
  accessibilityLabel: string;
}

export function planCopy(plan: Plan, context: { weekly: Plan | null; trial: string | null; locale?: string }): PlanCopy {
  const { product } = plan.pkg;
  const price = product.priceString;
  const period = PERIOD_PHRASES[plan.period];
  const title = PLAN_TITLES[plan.period];
  const name = PLAN_PRODUCT_NAMES[plan.period];
  const manage = "Manage or cancel anytime in your Apple Account settings.";

  if (context.trial) {
    const trial = context.trial;
    return {
      title,
      price,
      saveChip: null,
      subLine: `${trial} free, then ${price} ${period}`,
      buttonLabel: `Start ${trial} free`,
      renewalText: `${name}: free for ${trial}, then ${price} ${period}, charged to your Apple Account. It renews at ${price} ${period} unless cancelled at least 24 hours before the trial or period ends, and each renewal is charged within the 24 hours before the period ends. If you buy another plan during the trial, the unused free days end. ${manage}`,
      accessibilityLabel: `${title}, ${trial} free, then ${price} ${period}`,
    };
  }

  const save = savingsPercent(plan, context.weekly);
  const saveChip = save === null ? null : `Save ${save}%`;
  const perWeek =
    plan.period === "week" ? null : formatMoney(pricePerWeek(product.price, plan.period), product.currencyCode, context.locale);
  const every = BILLED_EVERY[plan.period];

  return {
    title,
    price,
    saveChip,
    subLine: perWeek ? `${perWeek}/wk, billed ${every}` : `Billed ${every}`,
    buttonLabel: `Get DuoQueue+ · ${price} ${period}`,
    renewalText: `${name}, ${price} ${period}, charged to your Apple Account when you confirm. It renews at ${price} ${period} unless cancelled at least 24 hours before the period ends, and each renewal is charged within the 24 hours before the period ends. ${manage}`,
    accessibilityLabel: [`${title}, ${price} ${period}`, perWeek ? `${perWeek} a week` : null, saveChip ? saveChip.toLowerCase() : null]
      .filter((part): part is string => part !== null)
      .join(", "),
  };
}
