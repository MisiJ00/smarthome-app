import { Share, StyleSheet, View } from 'react-native';

import { formatTime, type SetupCode } from '../../lib/admin';
import { space, useColors, withAlpha } from '../../lib/theme';
import { AppText, Banner, Button, Muted } from '../ui';

/**
 * Shown once after creating a user or asking for a new code: the person needs the link and the code to choose their
 * password. Selectable (long press copies) and shareable (messenger, mail).
 */
export function SetupCodeCard({ name, code, onClose }: { name: string; code: SetupCode; onClose: () => void }) {
  const c = useColors();
  const share = () =>
    void Share.share({
      message: `Hallo ${name}, hier richtest du dein Smart-Home-Konto ein:\n${code.link ?? ''}\nCode: ${code.code ?? ''}\n(gültig bis ${formatTime(code.expiresAt)})`,
    }).catch(() => undefined);
  return (
    <Banner
      tone="accent"
      icon="rights"
      title={`Einrichtungscode für ${name}`}
      actions={
        <View style={styles.actions}>
          <Button title="Teilen" kind="primary" icon="more" onPress={share} small />
          <Button title="Schließen" kind="ghost" onPress={onClose} small />
        </View>
      }
    >
      <View style={styles.body}>
        <Muted small>Gültig bis {formatTime(code.expiresAt)}. Der Code wird nur jetzt angezeigt; bei Bedarf beim Benutzer einen neuen erzeugen.</Muted>
        <View style={[styles.box, { backgroundColor: withAlpha(c.text, 0.06) }]}>
          <Muted small>Code</Muted>
          <AppText variant="title" selectable accessibilityLabel={`Code ${code.code ?? ''}`}>
            {code.code ?? ''}
          </AppText>
        </View>
        <View style={[styles.box, { backgroundColor: withAlpha(c.text, 0.06) }]}>
          <Muted small>Link</Muted>
          <AppText variant="small" selectable>
            {code.link ?? ''}
          </AppText>
        </View>
      </View>
    </Banner>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  body: { gap: space.sm, marginTop: space.xs },
  box: { borderRadius: 14, padding: space.md, gap: 2 },
});
