import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCategories, useCreateCategory } from './api';

interface CategoryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (categoryId: string) => void;
}

export function CategoryPickerModal({ visible, onClose, onSelect }: CategoryPickerModalProps) {
  const theme = useTheme();
  const { data: categories } = useCategories();
  const createCategory = useCreateCategory();
  const [newName, setNewName] = useState('');

  function close() {
    setNewName('');
    onClose();
  }

  async function addAndSelect() {
    const name = newName.trim();
    if (!name || createCategory.isPending) return;
    const category = await createCategory.mutateAsync(name);
    onSelect(category.id);
    close();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <ThemedView type="backgroundElement" style={styles.sheet}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.three }}>
              Choose a category
            </ThemedText>

            <ThemedView style={styles.newRow}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="New category name"
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={addAndSelect}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              />
              <Pressable onPress={addAndSelect} disabled={!newName.trim() || createCategory.isPending} hitSlop={8}>
                <ThemedText type="linkPrimary">Add</ThemedText>
              </Pressable>
            </ThemedView>

            <FlatList
              data={categories ?? []}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onSelect(item.id);
                    close();
                  }}
                  style={styles.row}>
                  <ThemedText type="default">{item.name}</ThemedText>
                </Pressable>
              )}
            />
          </ThemedView>
        </Pressable>
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
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
