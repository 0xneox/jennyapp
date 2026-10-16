import React from 'react';
import { Text } from 'react-native';
import { CandyButton } from './candy/CandyButton';

interface HintButtonProps {
  tier?: 1 | 2;
  /** True when free hints are exhausted — next hint requires a rewarded ad. */
  adGated?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * 💡 Hint bulb — single action button:
 * Directly applies the next logical deduction on the board.
 * Gated by available stars (level stars + star milestone rewards).
 */
export const HintButton: React.FC<HintButtonProps> = ({ disabled, onPress }) => {
  return (
    <CandyButton
      skin="orange"
      size="sm"
      label="Hint"
      icon={<Text style={{ fontSize: 18 }}>💡</Text>}
      accessibilityLabel="Hint"
      accessibilityHint={
        disabled
          ? 'No hints available. Earn more stars to unlock hints!'
          : 'Jenny finds and places a deduction move.'
      }
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 44 }}
    />
  );
};
