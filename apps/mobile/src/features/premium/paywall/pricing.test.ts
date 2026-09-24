import { describe, expect, it } from "vitest";

import {
  INTRO_ELIGIBLE,
  WEEKS_PER_PERIOD,
  formatMoney,
  orderPlans,
  planCopy,
  planPeriodOf,
  pricePerWeek,
  savingsPercent,
  selectedPlan,
  trialLength,
  type Plan,
  type PlanIntroPrice,
  type PlanPackage,
  type PlanPeriod,
} from "./pricing";

function pkg(packageType: string, productId: string, price: number, introPrice: PlanIntroPrice | null = null): PlanPackage {
  return {
    identifier: `$rc_${productId}`,
    packageType,
    product: { identifier: productId, price, priceString: `$${price.toFixed(2)}`, currencyCode: "USD", introPrice },
  };
}

const weekly = pkg("WEEKLY", "duoqueue_plus_weekly", 4.99);
const monthly = pkg("MONTHLY", "duoqueue_plus_monthly", 7.99);
const threeMonth = pkg("THREE_MONTH", "duoqueue_plus_3mo", 17.99);
const sixMonth = pkg("SIX_MONTH", "duoqueue_plus_6mo", 29.99);
const plans = orderPlans([sixMonth, weekly, threeMonth, monthly]);

function planFor(period: PlanPeriod): Plan {
  const plan = plans.find((p) => p.period === period);
  if (!plan) throw new Error(`no ${period} plan`);
  return plan;
}
const weeklyPlan = planFor("week");
const ctx = { weekly: weeklyPlan, trial: null, locale: "en-US" };

describe("planPeriodOf", () => {
  it("reads RevenueCat's package type", () => {
    expect([weekly, monthly, threeMonth, sixMonth].map(planPeriodOf)).toEqual(["week", "month", "threeMonths", "sixMonths"]);
  });

  it("falls back to our own product id for a custom package", () => {
    expect(planPeriodOf(pkg("CUSTOM", "duoqueue_plus_3mo", 17.99))).toBe("threeMonths");
  });

  it("gives up rather than guess", () => {
    expect(planPeriodOf(pkg("ANNUAL", "duoqueue_plus_yearly", 59.99))).toBeNull();
  });
});

describe("orderPlans", () => {
  it("lists the plans shortest first, whatever order the store sends", () => {
    expect(plans.map((p) => p.period)).toEqual(["week", "month", "threeMonths", "sixMonths"]);
  });

  it("drops empty slots, unknown products and a second package for the same period", () => {
    const odd = orderPlans([null, undefined, monthly, pkg("CUSTOM", "something_else", 1), pkg("CUSTOM", "duoqueue_plus_monthly", 7.99)]);
    expect(odd.map((p) => p.pkg)).toEqual([monthly]);
  });
});

describe("selectedPlan", () => {
  it("is Monthly until the player picks", () => {
    expect(selectedPlan(plans, null)?.period).toBe("month");
  });

  it("follows the pick", () => {
    expect(selectedPlan(plans, threeMonth.identifier)?.period).toBe("threeMonths");
  });

  it("falls back to the first plan when Monthly is missing (the 3- and 6-month rows used to show nothing selected)", () => {
    const noMonthly = orderPlans([threeMonth, sixMonth]);
    expect(selectedPlan(noMonthly, null)?.period).toBe("threeMonths");
    expect(selectedPlan(noMonthly, "gone")?.period).toBe("threeMonths");
  });

  it("is null with no plans", () => {
    expect(selectedPlan([], null)).toBeNull();
  });
});

describe("pricePerWeek and savingsPercent", () => {
  it("counts a month as 52/12 weeks, never 4", () => {
    expect(WEEKS_PER_PERIOD.month).toBeCloseTo(4.3333, 4);
    expect(pricePerWeek(7.99, "month")).toBeCloseTo(1.8438, 4);
  });

  it("computes the list prices' savings from the store's numbers, rounded down", () => {
    expect(savingsPercent(planFor("month"), weeklyPlan)).toBe(63);
    expect(savingsPercent(planFor("threeMonths"), weeklyPlan)).toBe(72);
    expect(savingsPercent(planFor("sixMonths"), weeklyPlan)).toBe(76);
  });

  it("keeps an exact whole saving whole (floating point makes this one 44.99999999999999)", () => {
    const cheapWeek = orderPlans([pkg("WEEKLY", "duoqueue_plus_weekly", 1), pkg("THREE_MONTH", "duoqueue_plus_3mo", 7.15)]);
    const [week, three] = cheapWeek;
    if (!week || !three) throw new Error("no plans");
    expect(savingsPercent(three, week)).toBe(45);
  });

  it("claims nothing for Weekly, without a Weekly plan, or with no saving", () => {
    expect(savingsPercent(weeklyPlan, weeklyPlan)).toBeNull();
    expect(savingsPercent(planFor("month"), null)).toBeNull();
    const [pricey] = orderPlans([pkg("MONTHLY", "duoqueue_plus_monthly", 30)]);
    if (!pricey) throw new Error("no plan");
    expect(savingsPercent(pricey, weeklyPlan)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats in the store's currency", () => {
    expect(formatMoney(1.843846, "USD", "en-US")).toBe("$1.84");
    expect(formatMoney(1.153461, "GBP", "en-GB")).toBe("£1.15");
  });

  it("falls back to the code for a currency it cannot format", () => {
    expect(formatMoney(1.5, "NOT-A-CODE", "en-US")).toBe("NOT-A-CODE 1.50");
  });
});

describe("trialLength", () => {
  const week: PlanIntroPrice = { price: 0, periodUnit: "WEEK", periodNumberOfUnits: 1 };

  it("names a free intro offer this Apple Account is eligible for", () => {
    expect(trialLength(week, INTRO_ELIGIBLE)).toBe("1 week");
    expect(trialLength({ price: 0, periodUnit: "DAY", periodNumberOfUnits: 7 }, INTRO_ELIGIBLE)).toBe("7 days");
    expect(trialLength({ price: 0, periodUnit: "MONTH", periodNumberOfUnits: 1 }, INTRO_ELIGIBLE)).toBe("1 month");
  });

  it("says nothing for a paid intro price, which is not free", () => {
    expect(trialLength({ ...week, price: 0.99 }, INTRO_ELIGIBLE)).toBeNull();
  });

  it("says nothing unless RevenueCat says eligible (unknown, ineligible, no offer)", () => {
    for (const status of [undefined, 0, 1, 3]) expect(trialLength(week, status)).toBeNull();
  });

  it("says nothing with no intro offer or an unknown unit", () => {
    expect(trialLength(null, INTRO_ELIGIBLE)).toBeNull();
    expect(trialLength({ price: 0, periodUnit: "FORTNIGHT", periodNumberOfUnits: 1 }, INTRO_ELIGIBLE)).toBeNull();
  });
});

describe("planCopy", () => {
  it("writes Monthly exactly", () => {
    expect(planCopy(planFor("month"), ctx)).toEqual({
      title: "Monthly",
      price: "$7.99",
      subLine: "$1.84/wk, billed every month",
      saveChip: "Save 63%",
      buttonLabel: "Get DuoQueue+ · $7.99 a month",
      renewalText:
        "DuoQueue+ Monthly, $7.99 a month, charged to your Apple Account when you confirm. It renews at $7.99 a month unless cancelled at least 24 hours before the period ends, and each renewal is charged within the 24 hours before the period ends. Manage or cancel anytime in your Apple Account settings.",
      accessibilityLabel: "Monthly, $7.99 a month, $1.84 a week, save 63%",
    });
  });

  it("bills Weekly with no per-week line and no saving", () => {
    const copy = planCopy(weeklyPlan, ctx);
    expect(copy.subLine).toBe("Billed every week");
    expect(copy.saveChip).toBeNull();
    expect(copy.buttonLabel).toBe("Get DuoQueue+ · $4.99 a week");
    expect(copy.accessibilityLabel).toBe("Weekly, $4.99 a week");
  });

  it("names the longer periods", () => {
    const three = planCopy(planFor("threeMonths"), ctx);
    expect(three.title).toBe("3 Months");
    expect(three.subLine).toBe("$1.38/wk, billed every 3 months");
    expect(three.buttonLabel).toBe("Get DuoQueue+ · $17.99 every 3 months");
    expect(three.accessibilityLabel).toBe("3 Months, $17.99 every 3 months, $1.38 a week, save 72%");
    const six = planCopy(planFor("sixMonths"), ctx);
    expect(six.subLine).toBe("$1.15/wk, billed every 6 months");
    expect(six.saveChip).toBe("Save 76%");
    expect(six.renewalText.startsWith("DuoQueue+ 6-Month, $29.99 every 6 months, charged")).toBe(true);
  });

  it("switches to the trial wording only when given a trial", () => {
    const copy = planCopy(planFor("month"), { ...ctx, trial: "1 week" });
    expect(copy.subLine).toBe("1 week free, then $7.99 a month");
    expect(copy.buttonLabel).toBe("Start 1 week free");
    expect(copy.saveChip).toBeNull();
    expect(copy.renewalText).toBe(
      "DuoQueue+ Monthly: free for 1 week, then $7.99 a month, charged to your Apple Account. It renews at $7.99 a month unless cancelled at least 24 hours before the trial or period ends, and each renewal is charged within the 24 hours before the period ends. If you buy another plan during the trial, the unused free days end. Manage or cancel anytime in your Apple Account settings.",
    );
    expect(copy.accessibilityLabel).toBe("Monthly, 1 week free, then $7.99 a month");
  });

  it("carries every Schedule 2 line in the renewal paragraph", () => {
    const { renewalText } = planCopy(planFor("month"), ctx);
    for (const part of [
      "DuoQueue+ Monthly",
      "$7.99 a month",
      "charged to your Apple Account when you confirm",
      "renews at $7.99 a month",
      "at least 24 hours before the period ends",
      "charged within the 24 hours before the period ends",
      "Manage or cancel anytime in your Apple Account settings",
    ]) {
      expect(renewalText).toContain(part);
    }
  });

  it("has no em or en dash in any plan's words", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (const plan of plans) {
      for (const trial of [null, "7 days"]) {
        expect(JSON.stringify(planCopy(plan, { ...ctx, trial }))).not.toMatch(dashes);
      }
    }
  });
});
