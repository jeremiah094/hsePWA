import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { usePockets } from './api';

interface PocketOption {
  id: string | null;
  name: string;
}

interface PocketPickerModalProps {
  visible: boolean;
  accountId: string | undefined;
  onClose: () => void;
  onSelect: (pocketId: string | null) => void;
}

export function PocketPickerModal({ visible, accountId, onClose, onSelect }: PocketPickerModalProps) {
  const { data: pockets } = usePockets(accountId);
  const options: PocketOption[] = [{ id: null, name: 'No pocket' }, ...(pockets ?? [])];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <ThemedView type="backgroundElement" style={styles.sheet}>
          <ThemedText type="subtitle" style={{ marginBottom: Spacing.three }}>
            Move to pocket
          </ThemedText>
          <FlatList
            data={options}
            keyExtractor={(p) => p.id ?? 'none'}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                style={styles.row}>
                <ThemedText type="default">{item.name}</ThemedText>
              </Pressable>
            )}
          />
        </ThemedView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    maxHeight: '70%',
  },
  row: { paddingVertical: Spacing.two },
});
