package dev.homeserver.devicekey

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * The phone's approval key: a P-256 key in the Android Keystore that can only sign after a fingerprint (or other
 * strong biometric). The private key never leaves the secure hardware; the server only knows the public key.
 */
class DeviceKeyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceKey")

    AsyncFunction("isAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      BiometricManager.from(context).canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    }

    AsyncFunction("hasKey") { alias: String ->
      keyStore().containsAlias(alias)
    }

    AsyncFunction("createKey") { alias: String ->
      val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
      generator.initialize(
        KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
          .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
          .setDigests(KeyProperties.DIGEST_SHA256)
          .setUserAuthenticationRequired(true)
          // a new fingerprint makes the key unusable, so someone who adds theirs cannot approve
          .setInvalidatedByBiometricEnrollment(true)
          .build()
      )
      val pair = generator.generateKeyPair()
      Base64.encodeToString(pair.public.encoded, Base64.NO_WRAP)
    }

    AsyncFunction("deleteKey") { alias: String ->
      val store = keyStore()
      if (store.containsAlias(alias)) {
        store.deleteEntry(alias)
      }
    }

    AsyncFunction("sign") { alias: String, payload: String, title: String, subtitle: String, promise: Promise ->
      val activity = appContext.currentActivity as? FragmentActivity
        ?: return@AsyncFunction promise.reject(CodedException("NO_ACTIVITY", "Die App ist gerade nicht im Vordergrund", null))
      val key = keyStore().getKey(alias, null) as? PrivateKey
        ?: return@AsyncFunction promise.reject(CodedException("NO_KEY", "Auf diesem Handy ist kein Schlüssel eingerichtet", null))
      val signature = Signature.getInstance("SHA256withECDSA")
      try {
        signature.initSign(key)
      } catch (e: KeyPermanentlyInvalidatedException) {
        return@AsyncFunction promise.reject(CodedException("KEY_INVALIDATED", "Die Fingerabdrücke wurden geändert, richte das Handy neu ein", e))
      }
      val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          try {
            val signer = result.cryptoObject?.signature ?: signature
            signer.update(payload.toByteArray(Charsets.UTF_8))
            promise.resolve(Base64.encodeToString(signer.sign(), Base64.NO_WRAP))
          } catch (e: Exception) {
            promise.reject(CodedException("SIGN_FAILED", "Signieren hat nicht geklappt", e))
          }
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          val cancelled = errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON || errorCode == BiometricPrompt.ERROR_CANCELED
          promise.reject(CodedException(if (cancelled) "CANCELLED" else "AUTH_FAILED", errString.toString(), null))
        }
      })
      prompt.authenticate(
        BiometricPrompt.PromptInfo.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          .setAllowedAuthenticators(BIOMETRIC_STRONG)
          .setNegativeButtonText("Abbrechen")
          .build(),
        BiometricPrompt.CryptoObject(signature)
      )
    }.runOnQueue(Queues.MAIN)
  }

  private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

  private companion object {
    const val KEYSTORE = "AndroidKeyStore"
  }
}
