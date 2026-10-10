import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CandyPanel } from './candy/CandyPanel';
import { CandyButton } from './candy/CandyButton';
import { CANDY_TEXT } from '../utils/theme';
import { soundManager } from '../utils/soundManager';
import { telemetry } from '../utils/telemetry';

export const TERMS_URL = 'https://www.jennydoko.fun/terms';
export const PRIVACY_URL = 'https://www.jennydoko.fun/privacy';

interface LegalAcceptanceModalProps {
  visible: boolean;
  onAccept: () => void;
}

/**
 * One-time first-launch popup. Cannot be closed without accepting (Play
 * Console requirement: acceptance of Terms+Privacy must be explicit for apps
 * handling personal data / device advertising IDs). Hyperlinks open the
 * canonical website pages in the external browser.
 */
export const LegalAcceptanceModal: React.FC<LegalAcceptanceModalProps> = ({
  visible,
  onAccept,
}) => {
  const insets = useSafeAreaInsets();

  const openLink = async (url: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      soundManager.play('button');
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open legal link:', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Play Console: do NOT allow Android hardware-back to dismiss the
        // acceptance modal. Must explicitly accept or decline (decline =
        // user can't proceed to play). Here we are lenient but it's a
        // no-op — the button below is the ONLY gate.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
    >
      <View
        pointerEvents="auto"
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(16, insets.top),
            paddingBottom: Math.max(16, insets.bottom),
            paddingLeft: Math.max(24, insets.left),
            paddingRight: Math.max(24, insets.right),
          },
        ]}
      >
        <CandyPanel style={styles.modal} contentStyle={styles.modalFace}>
          <View style={styles.innerColumn}>
            <View style={styles.header}>
              <Text style={styles.title}>JennyDoko</Text>
            </View>

            <View style={styles.messageBox}>
              <Text style={styles.messageText}>
                Before you start your journey with Jenny and the puppies,
                please take a moment to review and accept our legal terms.
              </Text>
            </View>

            <View style={styles.linksBox}>
              <TouchableOpacity
                onPress={() => openLink(TERMS_URL)}
                style={styles.linkRow}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.linkEmoji}>📜</Text>
                <Text style={styles.linkLabel}>Terms</Text>
                <Text style={styles.linkArrow}>↗</Text>
              </TouchableOpacity>

              <View style={styles.linkDivider} />

              <TouchableOpacity
                onPress={() => openLink(PRIVACY_URL)}
                style={styles.linkRow}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.linkEmoji}>🔒</Text>
                <Text style={styles.linkLabel}>Privacy</Text>
                <Text style={styles.linkArrow}>↗</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.acceptanceHint}>
              By tapping the button below, you confirm that you have read and
              agree to the Terms and Privacy Policy linked above.
            </Text>

            <CandyButton
              block
              skin="green"
              size="lg"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                soundManager.play('complete');
                // One-shot: record that the user passed the legal gate. Version
                // number matches the storage key suffix so we can segment
                // cohorts when the legal text next revs.
                telemetry.track('legal_accept', { version: 'v1' });
                onAccept();
              }}
              label="Agree"
              style={styles.acceptButton}
            />
          </View>
        </CandyPanel>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 4, 24, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    flex: 1,
  },
  modal: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    flex: 1,
    alignSelf: 'center',
  },
  modalFace: {
    flex: 1,
    flexDirection: 'column',
    padding: 20,
  },
  innerColumn: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  header: {
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    letterSpacing: 0.3,
  },
  messageBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    color: CANDY_TEXT.onDark,
    lineHeight: 22,
    textAlign: 'center',
  },
  linksBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  linkDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 14,
  },
  linkEmoji: {
    fontSize: 18,
    marginRight: 12,
  },
  linkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#9EDCFF',
    textDecorationLine: 'underline',
  },
  linkArrow: {
    fontSize: 16,
    fontWeight: '900',
    color: '#9EDCFF',
    marginLeft: 8,
  },
  acceptanceHint: {
    fontSize: 12,
    fontWeight: '500',
    color: CANDY_TEXT.onDarkSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  acceptButton: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
});
