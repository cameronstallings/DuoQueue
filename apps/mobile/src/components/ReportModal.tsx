import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { REPORT_REASONS, type ReportReason } from "@duoqueue/shared-types";

import { useTheme } from "@/theme/useTheme";

import { ChipSelect } from "./ChipSelect";

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
  const { colors, spacing } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          style={{
            backgroundColor: colors.background,
            padding: spacing.lg,
            gap: spacing.md,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Report this user</Text>
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
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: spacing.sm,
              color: colors.text,
              minHeight: 80,
            }}
          />
          <Pressable
            disabled={!reason}
            onPress={() => reason && onSubmit(reason, details)}
            style={{
              backgroundColor: colors.danger,
              opacity: reason ? 1 : 0.5,
              padding: spacing.md,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Submit report</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ padding: spacing.sm, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
