import { FlatList, Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { useCategories } from './api';

interface CategoryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string) => void;
}

export function CategoryPickerModal({ visible, onClose, onSelect }: CategoryPickerModalProps) {
  const { data: categories } = useCategories();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <ThemedView type="backgroundElement" style={styles.sheet}>
          <ThemedText type="subtitle" style={{ marginBottom: Spacing.three }}>
            Choose a category
          </ThemedText>
          <FlatList
            data={categories ?? []}
            keyExtractor={(c) => c.id}
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
