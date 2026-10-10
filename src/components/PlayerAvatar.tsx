import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVATARS } from '../data/profileOptions';

interface PlayerAvatarProps {
  avatar: number;
  size?: number;
  selected?: boolean;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ avatar, size = 44, selected }) => {
  const def = AVATARS[avatar] ?? AVATARS[0];
  return (
    <View
      style={[
        styles.ring,
        {
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          borderColor: selected ? '#FFC93C' : 'rgba(255,255,255,0.85)',
          borderWidth: selected ? 3 : 2,
        },
      ]}
      accessibilityLabel={`${def.label} avatar`}
    >
      <LinearGradient
        colors={def.colors}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: Math.round(size * 0.58) }}>{def.emoji}</Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
