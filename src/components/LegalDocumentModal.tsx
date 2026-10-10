import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CandyPanel } from './candy/CandyPanel';
import { CandyButton } from './candy/CandyButton';
import { CANDY_GOLD, CANDY_SURFACE, CANDY_TEXT } from '../utils/theme';
import { LegalDocument } from '../data/legalText';

interface LegalDocumentModalProps {
  /** The document to show, or null to render nothing. */
  doc: LegalDocument | null;
  onClose: () => void;
}

/**
 * Scrollable legal document viewer (Terms / Privacy). Rendered as an
 * absolute-fill overlay so it can sit on top of the settings modal.
 */
export const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({ doc, onClose }) => {
  const insets = useSafeAreaInsets();
  if (!doc) return null;

  return (
    <View
      pointerEvents={doc ? 'auto' : 'none'}
      style={[
        styles.overlay,
        {
          paddingTop: Math.max(12, insets.top),
          paddingBottom: Math.max(12, insets.bottom),
          paddingLeft: Math.max(20, insets.left),
          paddingRight: Math.max(20, insets.right),
        },
      ]}
    >
      <CandyPanel style={styles.modal} contentStyle={styles.modalFace}>
        {/* Intermediate flex column so ScrollView fills the leftover space
            between the sticky header and the sticky Close button. */}
        <View style={styles.innerColumn}>
          <View style={styles.header}>
            <Text style={styles.title}>📜 {doc.title}</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={styles.closeIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.updated}>Last updated: {doc.lastUpdated}</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {doc.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.sectionHeading}>{section.heading}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>

          <CandyButton
            block
            skin="neutral"
            label="Close"
            onPress={onClose}
            style={styles.closeButton}
          />
        </View>
      </CandyPanel>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 6, 32, 0.90)',
    // NOT justifyContent:'center' — that would compress the flex column
    // children into their intrinsic (unscrollable) content size.
    zIndex: 1100,
  },
  modal: {
    width: '100%',
    maxWidth: 460,
    // Critical: the wrapper must be a flex:1 participant so it inherits a
    // BOUNDED height from the inset-padded overlay. Without this, the panel
    // is height:undefined and the ScrollView below expands to full content
    // height (no scroll).
    flex: 1,
    maxHeight: '100%',
    // Panel sits flush with overlay inset padding; this keeps the shadow
    // comfortably visible against the dim.
    alignSelf: 'center',
  },
  modalFace: {
    padding: 20,
    borderColor: CANDY_GOLD.base,
    borderWidth: 2,
    // LinearGradient has no implicit flex — it must inherit the bounded
    // outer frame so our inner column can lay out with a known leftover
    // space for the ScrollView.
    flex: 1,
    flexDirection: 'column',
    // Face overflow is already 'hidden' from CandyPanel defaults — keep it
    // so the ScrollView's scroll indicator stays inside the rounded bevel.
  },
  innerColumn: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: CANDY_GOLD.light,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  closeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(20, 10, 44, 0.45)',
    borderWidth: 1.5,
    borderColor: CANDY_SURFACE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    fontSize: 16,
    color: CANDY_TEXT.onDarkSoft,
    fontWeight: '900',
  },
  updated: {
    fontSize: 11,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  scroll: {
    // flex:1 means the ScrollView consumes all *leftover* vertical space
    // between the header+updated and the Close button. With a bounded
    // parent this produces the clipped frame that enables scrolling.
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    // Bottom padding inside the scrollable region so the last paragraph
    // isn't flush against the Close button's top margin — guarantees the
    // user can always read every line.
    paddingBottom: 8,
  },
  section: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: CANDY_GOLD.base,
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 13,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkSoft,
    lineHeight: 19,
  },
  closeButton: {
    marginTop: 14,
  },
});
