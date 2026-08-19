/**
 * Format 4 of the spec's four: the list. No footage at all, which makes it the cheapest to
 * render and the only one that can be written on a day when nothing has been recorded.
 *
 * It is also the one that has to look most like the app, because there is no footage carrying
 * that job: a section label, indexed rows and 1px seams are the app's own settings list, and
 * if this frame does not read as DuoQueue then nothing on screen does.
 */
import { AbsoluteFill } from "remotion";

import { darkColors, hairline, spacing } from "@app/theme/tokens";

import { HookLine } from "@/components/HookLine";
import { PostShell } from "@/components/PostShell";
import { SectionLabel } from "@/components/SectionLabel";
import { Stage } from "@/components/Stage";
import { Tick } from "@/components/Tick";
import type { Cta } from "@/config/phase";
import { useEnter } from "@/lib/enter";
import { px, SAFE, VIDEO_W } from "@/lib/scale";
import type { SpecHook } from "@/types";

/** Frames between rows. Shorter than Pain's 18 because these lines are read as a list rather
 * than as consecutive sentences, and four of them at 18 would still be arriving three seconds
 * in. */
const ROW_STAGGER = 14;

/** The index column. Wide enough for `[ 01 ]` in the tick face with room for a third digit, so
 * every row's text starts at the same x whatever the list is. */
const INDEX_W = px(spacing.xxl);
const ROW_GAP = px(spacing.md);
/** What is left of the safe box once the index column has taken its share. Passing this to
 * HookLine is what keeps a long item inside SAFE.side rather than fitted to the whole box and
 * then pushed right by the index. */
const TEXT_W = VIDEO_W - SAFE.side * 2 - INDEX_W - ROW_GAP;

const Row = ({ index, text }: { index: number; text: string }) => {
  const delayFrames = (index + 1) * ROW_STAGGER;
  const entrance = useEnter(delayFrames);

  return (
    <div>
      {/* The seam is a div rather than a border on the row so it can arrive with the row. It
          is the app's hairline at the app's border colour, scaled: 1px on a 3x phone is 3px
          here, which is why it is px(hairline) and not 1. */}
      <div style={{ height: px(hairline), backgroundColor: darkColors.border, ...entrance }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ROW_GAP,
          paddingTop: px(spacing.md),
          paddingBottom: px(spacing.md),
        }}
      >
        {/* Tick is already the machine voice in voltDim, brackets and all, so the index is
            the same object here as the `[ 12:04 ]` timestamps in the app's chat. */}
        <div style={{ width: INDEX_W, ...entrance }}>
          <Tick>{String(index + 1).padStart(2, "0")}</Tick>
        </div>
        <HookLine text={text} size="item" delayFrames={delayFrames} withinWidth={TEXT_W} />
      </div>
    </div>
  );
};

const Body = ({ hook }: { hook: SpecHook }) => {
  const entrance = useEnter();

  return (
    <Stage>
      {/* Rows sit on the ground rather than inside a Card, which is how the app groups them.
          At display scale a panel's own padding would take 132px off a 888px box, shrinking
          every item by about a fifth to buy an edge the graticule already provides. The seam
          is the part of that idiom doing the work. */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          paddingTop: SAFE.top,
          paddingBottom: SAFE.bottom,
          paddingLeft: SAFE.side,
          paddingRight: SAFE.side,
        }}
      >
        <div style={entrance}>
          <SectionLabel>{hook.title}</SectionLabel>
        </div>
        {hook.items.map((item, index) => (
          <Row key={index} index={index} text={item} />
        ))}
      </AbsoluteFill>
    </Stage>
  );
};

export const Spec = ({ hook, cta }: { hook: SpecHook; cta: Cta }) => (
  <PostShell cta={cta}>
    <Body hook={hook} />
  </PostShell>
);
