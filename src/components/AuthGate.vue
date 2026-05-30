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

const guidance = computed(() => [
  t('authGate.guidance.localOnly'),
  t('authGate.guidance.publicKeyOnly'),
  t('authGate.guidance.deterministicSeed'),
])

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
  <div class="min-h-screen bg-(--bg-body) text-(--text-primary)">
    <div class="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-6 px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center lg:px-8">
      <section class="smooth-shadow-lg animate-fadeIn rounded-[28px] bg-(--surface) px-6 py-7 sm:px-8 sm:py-9">
        <div class="inline-flex items-center gap-2 rounded-full bg-(--surface-muted) px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-(--text-secondary)">
          <ShieldCheck class="h-4 w-4" />
          <span>{{ t('authGate.badge') }}</span>
        </div>

        <div class="mt-5 max-w-2xl">
          <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{{ title }}</h1>
          <p class="mt-3 text-sm leading-6 text-(--text-secondary) sm:text-base">
            {{ subtitle }}
          </p>
        </div>

        <div v-if="authState.booting" class="mt-8 flex items-center gap-3 rounded-2xl bg-(--surface-muted) px-4 py-4 text-sm text-(--text-secondary)">
          <LoaderCircle class="h-5 w-5 animate-spin text-(--text-primary)" />
          <span>{{ t('authGate.bootingState') }}</span>
        </div>

        <form v-else class="mt-8 space-y-4" @submit.prevent="submit">
          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--text-secondary)">
              <UserRound class="h-4 w-4" />
              {{ t('authGate.username') }}
            </span>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              :placeholder="t('authGate.usernamePlaceholder')"
              class="min-h-12 w-full rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary)/80"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--text-secondary)">
              <KeyRound class="h-4 w-4" />
              {{ t('authGate.password') }}
            </span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              :placeholder="t('authGate.passwordPlaceholder')"
              class="min-h-12 w-full rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary)/80"
            />
          </label>

          <label class="block">
            <span class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--text-secondary)">
              <Fingerprint class="h-4 w-4" />
              {{ t('authGate.pin') }}
            </span>
            <input
              v-model="pin"
              type="password"
              inputmode="numeric"
              autocomplete="one-time-code"
              :placeholder="t('authGate.pinPlaceholder')"
              class="min-h-12 w-full rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary)/80"
            />
          </label>

          <p class="rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm leading-6 text-(--text-secondary)">
            {{ t('authGate.seedNote') }}
          </p>

          <p v-if="localError || authState.error" class="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {{ localError || authState.error }}
          </p>

          <button
            type="submit"
            :disabled="submitting"
            class="smooth-shadow flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
            <LockKeyhole v-else class="h-4 w-4" />
            <span>{{ submitting ? t('authGate.working') : isSetup ? t('authGate.setupAction') : t('authGate.loginAction') }}</span>
          </button>
        </form>
      </section>

      <aside class="smooth-shadow-lg animate-fadeIn rounded-[28px] bg-(--surface) px-6 py-7 sm:px-8 sm:py-9" style="animation-delay: 70ms">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-(--text-secondary)">{{ t('authGate.sideLabel') }}</p>
        <h2 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('authGate.sideTitle') }}</h2>
        <p class="mt-3 text-sm leading-6 text-(--text-secondary)">
          {{ t('authGate.sideSubtitle') }}
        </p>

        <div class="mt-6 space-y-4">
          <div class="space-y-3 rounded-3xl bg-(--bg-body) px-4 py-4 smooth-shadow">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-(--text-secondary)">{{ t('authGate.previewLabel') }}</p>
                <p class="mt-1 text-sm leading-6 text-(--text-secondary)">
                  {{ t('authGate.previewHint') }}
                </p>
              </div>

              <button
                type="button"
                :disabled="!previewReady"
                class="smooth-shadow inline-flex min-h-11 items-center gap-2 rounded-2xl bg-black px-3 py-2 text-xs font-semibold text-white hover:-translate-y-0.5 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                @click="copyText(previewPublicKey, t('authGate.messages.publicKeyCopied'))"
              >
                <Copy class="h-4 w-4" />
                <span>{{ t('authGate.copyKey') }}</span>
              </button>
            </div>

            <div class="rounded-2xl bg-(--surface) px-4 py-4 smooth-shadow">
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

          <div v-for="item in guidance" :key="item" class="flex items-start gap-3 rounded-2xl bg-(--bg-body) px-4 py-4 smooth-shadow">
            <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-(--text-primary)" />
            <p class="text-sm leading-6 text-(--text-secondary)">{{ item }}</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>