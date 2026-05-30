<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Fingerprint, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, UserRound } from 'lucide-vue-next'
import { useNotification } from '../composables/useNotification'
import { deriveDeterministicIdentity, useYantrAuth } from '../composables/useYantrAuth'

const { t } = useI18n()
const toast = useNotification()
const { authState, loginYantr, setupYantrAdmin } = useYantrAuth()

const username = ref(localStorage.getItem('yantr-username') || '')
const password = ref('')
const pin = ref('')
const submitting = ref(false)
const localError = ref('')
const previewPublicKey = ref('')
const previewLoading = ref(false)

let previewTimer = null
let previewRequestId = 0

const isSetup = computed(() => !authState.configured)
const title = computed(() => authState.booting
  ? t('authGate.bootingTitle')
  : isSetup.value ? t('authGate.setupTitle') : t('authGate.loginTitle'))
const subtitle = computed(() => authState.booting
  ? t('authGate.bootingSubtitle')
  : isSetup.value ? t('authGate.setupSubtitle') : t('authGate.loginSubtitle'))

const hasPreviewInput = computed(() => (
  Boolean(String(username.value).trim())
  || Boolean(password.value)
  || Boolean(String(pin.value).trim())
))

const previewReady = computed(() => Boolean(previewPublicKey.value))

function shouldPreviewKey() {
  return Boolean(String(username.value).trim())
    && String(password.value).length >= 8
    && String(pin.value).trim().length >= 4
}

async function updatePreviewKey() {
  const requestId = ++previewRequestId
  if (previewTimer) clearTimeout(previewTimer)

  if (!shouldPreviewKey()) {
    previewLoading.value = false
    previewPublicKey.value = ''
    return
  }

  previewLoading.value = true
  previewTimer = setTimeout(async () => {
    try {
      const identity = await deriveDeterministicIdentity({
        username: username.value,
        password: password.value,
        pin: pin.value,
      })
      if (requestId !== previewRequestId) return
      previewPublicKey.value = identity.publicKey
    } catch {
      if (requestId !== previewRequestId) return
      previewPublicKey.value = ''
    } finally {
      if (requestId === previewRequestId) previewLoading.value = false
    }
  }, 180)
}

async function copyText(value, message) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toast.success(message)
  } catch {
    toast.error(t('authGate.errors.copyFailed'))
  }
}

watch([username, password, pin], () => {
  updatePreviewKey()
}, { immediate: true })

onUnmounted(() => {
  if (previewTimer) clearTimeout(previewTimer)
})

function validate() {
  if (!String(username.value).trim()) return t('authGate.errors.usernameRequired')
  if (String(password.value).length < 8) return t('authGate.errors.passwordLength')
  if (String(pin.value).trim().length < 4) return t('authGate.errors.pinLength')
  return ''
}

async function submit() {
  const errorMessage = validate()
  if (errorMessage) {
    localError.value = errorMessage
    return
  }

  submitting.value = true
  localError.value = ''

  try {
    if (isSetup.value) {
      await setupYantrAdmin({ username: username.value, password: password.value, pin: pin.value })
      toast.success(t('authGate.messages.setupComplete'))
    } else {
      await loginYantr({ username: username.value, password: password.value, pin: pin.value })
      toast.success(t('authGate.messages.loginComplete'))
    }
    password.value = ''
    pin.value = ''
  } catch (error) {
    localError.value = error.message || t('authGate.errors.generic')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-(--bg-body) text-(--text-primary)"
    style="--bg-body: #000000; --surface: #0a0a0a; --surface-muted: #111111; --text-primary: #f5f5f5; --text-secondary: #a3a3a3"
  >
    <div class="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section class="smooth-shadow-lg animate-fadeIn rounded-4xl bg-(--surface) px-6 py-8 sm:px-10 sm:py-10">
        <div class="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-blue-200">
          <ShieldCheck class="h-4 w-4" />
          <span>{{ t('authGate.badge') }}</span>
        </div>

        <div class="mt-6 max-w-2xl">
          <h1 class="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">{{ title }}</h1>
          <p class="mt-4 max-w-xl text-base leading-7 text-(--text-secondary)">
            {{ subtitle }}
          </p>
        </div>

        <div v-if="authState.booting" class="mt-10 flex items-center gap-3 rounded-3xl bg-(--surface-muted) px-4 py-4 text-sm text-(--text-secondary) smooth-shadow">
          <LoaderCircle class="h-5 w-5 animate-spin text-(--text-primary)" />
          <span>{{ t('authGate.bootingState') }}</span>
        </div>

        <form v-else class="mt-10 space-y-5" @submit.prevent="submit">
          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
              <UserRound class="h-4 w-4" />
              {{ t('authGate.username') }}
            </span>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              :placeholder="t('authGate.usernamePlaceholder')"
              class="smooth-shadow min-h-13 w-full rounded-3xl bg-(--surface-muted) px-4 py-3.5 text-base text-(--text-primary) placeholder:text-(--text-secondary)/70"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
              <KeyRound class="h-4 w-4" />
              {{ t('authGate.password') }}
            </span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              :placeholder="t('authGate.passwordPlaceholder')"
              class="smooth-shadow min-h-13 w-full rounded-3xl bg-(--surface-muted) px-4 py-3.5 text-base text-(--text-primary) placeholder:text-(--text-secondary)/70"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
              <Fingerprint class="h-4 w-4" />
              {{ t('authGate.pin') }}
            </span>
            <input
              v-model="pin"
              type="password"
              inputmode="numeric"
              autocomplete="one-time-code"
              :placeholder="t('authGate.pinPlaceholder')"
              class="smooth-shadow min-h-13 w-full rounded-3xl bg-(--surface-muted) px-4 py-3.5 text-base text-(--text-primary) placeholder:text-(--text-secondary)/70"
            />
          </label>

          <p class="rounded-3xl bg-(--surface-muted) px-4 py-4 text-sm leading-6 text-(--text-secondary) smooth-shadow">
            {{ t('authGate.seedNote') }}
          </p>

          <div class="space-y-3 rounded-3xl bg-(--surface-muted) px-4 py-4 smooth-shadow">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-white">{{ t('authGate.previewLabel') }}</p>
                <p class="mt-1 text-sm leading-6 text-(--text-secondary)">
                  {{ t('authGate.previewHint') }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!previewReady"
                class="smooth-shadow inline-flex min-h-11 items-center gap-2 rounded-2xl bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                @click="copyText(previewPublicKey, t('authGate.messages.publicKeyCopied'))"
              >
                <Copy class="h-4 w-4" />
                <span>{{ t('authGate.copyKey') }}</span>
              </button>
            </div>

            <div class="rounded-3xl bg-(--surface) px-4 py-4 smooth-shadow">
              <p v-if="previewLoading" class="flex items-center gap-2 text-sm text-(--text-secondary)">
                <LoaderCircle class="h-4 w-4 animate-spin text-(--text-primary)" />
                <span>{{ t('authGate.previewWorking') }}</span>
              </p>
              <p v-else-if="previewReady" class="break-all font-mono text-xs leading-6 text-(--text-primary)">
                {{ previewPublicKey }}
              </p>
              <p v-else class="text-sm leading-6 text-(--text-secondary)">
                {{ hasPreviewInput ? t('authGate.previewIncomplete') : t('authGate.previewPending') }}
              </p>
            </div>
          </div>

          <p v-if="localError || authState.error" class="rounded-3xl bg-red-500/10 px-4 py-4 text-sm font-medium text-red-200 smooth-shadow">
            {{ localError || authState.error }}
          </p>

          <button
            type="submit"
            :disabled="submitting"
            class="smooth-shadow flex min-h-13 w-full items-center justify-center gap-2 rounded-3xl bg-blue-500 px-4 py-3.5 text-base font-semibold text-white hover:-translate-y-0.5 hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
            <LockKeyhole v-else class="h-4 w-4" />
            <span>{{ submitting ? t('authGate.working') : isSetup ? t('authGate.setupAction') : t('authGate.loginAction') }}</span>
          </button>
        </form>
      </section>
    </div>
  </div>
</template>