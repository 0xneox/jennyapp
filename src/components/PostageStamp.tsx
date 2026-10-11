import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Chapter } from '../data/chapterData';

interface PostageStampProps {
  chapter: Chapter;
  size?: 'sm' | 'md' | 'lg';
  isStamped?: boolean;
}

/**
 * High-craft collectible Postage Stamp component.
 * Features realistic serrated postage perforations, postal cancel marks,
 * chapter icon, and vintage/candy gold typography.
 */
export const PostageStamp: React.FC<PostageStampProps> = ({
  chapter,
  size = 'md',
  isStamped = true,
}) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const width = isSm ? 58 : isLg ? 160 : 96;
  const height = isSm ? 70 : isLg ? 195 : 116;
  const iconSize = isSm ? 18 : isLg ? 46 : 28;
  const perfCount = isSm ? 6 : isLg ? 10 : 8;

  return (
    <View style={[styles.stampWrapper, { width, height }]}>
      {/* Top perforated holes */}
      <View style={styles.perfRowTop}>
        {Array.from({ length: perfCount }).map((_, i) => (
          <View key={`pt-${i}`} style={[styles.perfHole, isSm && styles.perfHoleSm, isLg && styles.perfHoleLg]} />
        ))}
      </View>

      {/* Bottom perforated holes */}
      <View style={styles.perfRowBottom}>
        {Array.from({ length: perfCount }).map((_, i) => (
          <View key={`pb-${i}`} style={[styles.perfHole, isSm && styles.perfHoleSm, isLg && styles.perfHoleLg]} />
        ))}
      </View>

      {/* Stamp Body Card */}
      <View
        style={[
          styles.stampBody,
          {
            borderColor: chapter.accentColor,
            backgroundColor: isStamped ? '#FFFDF8' : 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      >
        {/* Inner engraved border */}
        <View style={[styles.innerFrame, { borderColor: chapter.accentColor + (isStamped ? '88' : '33') }]}>
          {/* Header ribbon */}
          <View style={[styles.stampHeader, { backgroundColor: chapter.accentColor }]}>
            <Text style={[styles.stampPostalText, isSm && styles.stampPostalTextSm, isLg && styles.stampPostalTextLg]}>
              JENNYDOKO POST
            </Text>
          </View>

          {/* Center vignette / chapter illustration */}
          <View
            style={[
              styles.stampCenter,
              { backgroundColor: isStamped ? chapter.accentColor + '18' : 'transparent' },
            ]}
          >
            <Text style={{ fontSize: iconSize }}>{chapter.icon}</Text>
          </View>

          {/* Bottom denomination & chapter title */}
          <View style={styles.stampFooter}>
            <Text
              style={[
                styles.stampNumberText,
                { color: chapter.accentColor },
                isSm && styles.stampNumberTextSm,
                isLg && styles.stampNumberTextLg,
              ]}
            >
              No. {chapter.id}
            </Text>
            {!isSm && (
              <Text
                style={[
                  styles.stampTitleText,
                  { color: isStamped ? '#3A2465' : '#AE99E0' },
                  isLg && styles.stampTitleTextLg,
                ]}
                numberOfLines={1}
              >
                {chapter.title}
              </Text>
            )}
          </View>

          {/* Postal Inked Postmark Cancellation Stamp */}
          {isStamped && (
            <View
              style={[
                styles.cancelMark,
                {
                  borderColor: chapter.accentColor + 'B0',
                  transform: [{ rotate: '-18deg' }],
                },
                isSm && styles.cancelMarkSm,
                isLg && styles.cancelMarkLg,
              ]}
            >
              <Text
                style={[
                  styles.cancelMarkText,
                  { color: chapter.accentColor },
                  isSm && styles.cancelMarkTextSm,
                  isLg && styles.cancelMarkTextLg,
                ]}
              >
                CLEARED
              </Text>
              <View style={[styles.cancelLine, { backgroundColor: chapter.accentColor }]} />
              <Text
                style={[
                  styles.cancelSubText,
                  { color: chapter.accentColor },
                  isSm && styles.cancelSubTextSm,
                  isLg && styles.cancelSubTextLg,
                ]}
              >
                20/20 🐾
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stampWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampBody: {
    width: '92%',
    height: '92%',
    borderRadius: 6,
    borderWidth: 2,
    padding: 3,
    shadowColor: '#0E0620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
    overflow: 'hidden',
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  stampHeader: {
    width: '100%',
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  stampPostalText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stampPostalTextSm: {
    fontSize: 5,
    letterSpacing: 0.2,
  },
  stampPostalTextLg: {
    fontSize: 10,
    letterSpacing: 1,
    paddingVertical: 2,
  },
  stampCenter: {
    width: '84%',
    flex: 1,
    marginVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampFooter: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 1,
  },
  stampNumberText: {
    fontSize: 10,
    fontWeight: '900',
  },
  stampNumberTextSm: {
    fontSize: 8,
  },
  stampNumberTextLg: {
    fontSize: 14,
    fontWeight: '900',
  },
  stampTitleText: {
    fontSize: 8,
    fontWeight: '800',
  },
  stampTitleTextLg: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  /* Perforation notches on top and bottom edges */
  perfRowTop: {
    position: 'absolute',
    top: 0,
    left: '6%',
    right: '6%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  perfRowBottom: {
    position: 'absolute',
    bottom: 0,
    left: '6%',
    right: '6%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  perfHole: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#382066', // Blends into deep grape backdrop
  },
  perfHoleSm: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  perfHoleLg: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  /* Postal cancel rubber stamp effect */
  cancelMark: {
    position: 'absolute',
    top: '25%',
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  cancelMarkSm: {
    paddingHorizontal: 3,
    paddingVertical: 1.5,
    right: -2,
    borderWidth: 1,
  },
  cancelMarkLg: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    right: 6,
    top: '30%',
  },
  cancelMarkText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelMarkTextSm: {
    fontSize: 6,
  },
  cancelMarkTextLg: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelLine: {
    height: 1,
    width: '100%',
    marginVertical: 1,
    opacity: 0.7,
  },
  cancelSubText: {
    fontSize: 6.5,
    fontWeight: '800',
  },
  cancelSubTextSm: {
    fontSize: 5,
  },
  cancelSubTextLg: {
    fontSize: 10,
  },
});
