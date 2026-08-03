import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { REPORT_REASONS, type ReportReason } from "@duoqueue/shared-types";

import { useTheme } from "@/theme/useTheme";

import { ChipSelect } from "./ChipSelect";
import { Sheet } from "./Sheet";

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment",
  spam: "Spam",
  inappropriate_content: "Inappropriate content",
  underage: "Underage",
  other: "Other",
};

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => void;
}

export function ReportModal({ visible, onClose, onSubmit }: ReportModalProps) {
  const { colors, radius, spacing, type } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  return (
    <Sheet visible={visible} onClose={onClose} title="Report this user" dismissable={false}>
      <View style={{ gap: spacing.md }}>
        <ChipSelect
          options={REPORT_REASONS.map((value) => ({ value, label: REPORT_REASON_LABELS[value] }))}
          selected={reason ? [reason] : []}
          onToggle={setReason}
        />
        <TextInput
          placeholder="Additional details (optional)"
          placeholderTextColor={colors.textMuted}
          value={details}
          onChangeText={setDetails}
          multiline
          style={[
            type.body,
            {
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.input,
              padding: spacing.sm,
              color: colors.text,
              minHeight: 80,
            },
          ]}
        />
        <Pressable
          disabled={!reason}
          onPress={() => reason && onSubmit(reason, details)}
          style={{
            backgroundColor: reason ? colors.dangerDark : "transparent",
            borderWidth: 1,
            borderColor: reason ? colors.dangerDark : colors.danger,
            padding: spacing.md,
            borderRadius: radius.button,
            alignItems: "center",
          }}
        >
          <Text style={[type.bodyStrong, { color: reason ? colors.onFill : colors.danger }]}>Submit report</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ padding: spacing.sm, alignItems: "center" }}>
          <Text style={[type.body, { color: colors.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
