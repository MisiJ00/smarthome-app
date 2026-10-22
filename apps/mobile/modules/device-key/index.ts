import { requireNativeModule } from 'expo';

/** Native part, see android/src/main/java/dev/homeserver/devicekey/DeviceKeyModule.kt. Android only. */
type DeviceKeyNative = {
  isAvailable(): Promise<boolean>;
  hasKey(alias: string): Promise<boolean>;
  /** Creates a new key and returns its public key (SubjectPublicKeyInfo, Base64). */
  createKey(alias: string): Promise<string>;
  deleteKey(alias: string): Promise<void>;
  /** Asks for the fingerprint, then signs payload with SHA256withECDSA; returns the DER signature as Base64. */
  sign(alias: string, payload: string, title: string, subtitle: string): Promise<string>;
};

export default requireNativeModule<DeviceKeyNative>('DeviceKey');
