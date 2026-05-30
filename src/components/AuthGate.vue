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
  <div class="min-h-screen bg-(--bg-body) text-(--text-primary)">
    <div class="relative mx-auto flex min-h-screen w-full max-w-7xl items-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div class="pointer-events-none absolute left-1/2 top-0 h-72 w-full max-w-5xl -translate-x-1/2 rounded-b-[4rem] bg-(--surface-muted) opacity-70"></div>

      <section class="animate-fadeIn relative grid w-full items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px] lg:gap-12">
        <div class="order-2 flex flex-col justify-center py-4 lg:order-1 lg:py-8">
          <div class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-(--text-secondary)">
            <ShieldCheck class="h-4 w-4" />
            <span>{{ t('authGate.badge') }}</span>
          </div>

          <div class="mt-6 max-w-4xl">
            <h1 class="max-w-3xl text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.06em] sm:text-6xl lg:text-[5.6rem]">
              {{ title }}
            </h1>
            <p class="mt-5 max-w-lg text-base leading-7 text-(--text-secondary) sm:text-lg">
              {{ subtitle }}
            </p>
          </div>

          <div class="mt-8 max-w-xl text-sm leading-6 text-(--text-secondary)">
            <p>{{ t('authGate.seedNote') }}</p>
          </div>

          <div class="relative mt-8 max-w-4xl">
            <div class="absolute inset-0 translate-x-4 translate-y-4 rounded-4xl bg-(--surface-muted) opacity-100"></div>
            <div class="relative rounded-4xl bg-(--surface) px-5 py-5 smooth-shadow-lg sm:px-7 sm:py-7">
              <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--text-secondary)">{{ t('authGate.previewLabel') }}</p>
                  <p class="mt-2 max-w-md text-sm leading-6 text-(--text-secondary)">
                    {{ t('authGate.previewHint') }}
                  </p>
                </div>

                <button
                  type="button"
                  :disabled="!previewReady"
                  class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-(--text-primary) px-4 py-2 text-sm font-medium text-(--bg-body) smooth-shadow hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  @click="copyText(previewPublicKey, t('authGate.messages.publicKeyCopied'))"
                >
                  <Copy class="h-4 w-4" />
                  <span>{{ t('authGate.copyKey') }}</span>
                </button>
              </div>

              <div class="mt-6 rounded-4xl bg-(--surface-muted) px-5 py-5 smooth-shadow sm:px-6 sm:py-6">
                <p v-if="previewLoading" class="flex min-h-24 items-center gap-2 text-sm text-(--text-secondary)">
                  <LoaderCircle class="h-4 w-4 animate-spin text-(--text-primary)" />
                  <span>{{ t('authGate.previewWorking') }}</span>
                </p>
                <p v-else-if="previewReady" class="break-all font-mono text-sm leading-8 text-(--text-primary) sm:text-[15px]">
                  {{ previewPublicKey }}
                </p>
                <p v-else class="flex min-h-24 items-center text-sm leading-7 text-(--text-secondary)">
                  {{ hasPreviewInput ? t('authGate.previewIncomplete') : t('authGate.previewPending') }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="order-1 lg:order-2">
          <div class="relative">
            <div class="absolute inset-0 translate-x-3 translate-y-3 rounded-4xl bg-(--surface-muted) opacity-90"></div>
            <div class="relative rounded-4xl bg-(--surface) px-5 py-6 smooth-shadow-lg sm:px-6 sm:py-7 lg:mt-16">
              <div v-if="authState.booting" class="flex min-h-90 items-center gap-3 text-sm text-(--text-secondary)">
                <LoaderCircle class="h-5 w-5 animate-spin text-(--text-primary)" />
                <span>{{ t('authGate.bootingState') }}</span>
              </div>

              <form v-else class="space-y-5" @submit.prevent="submit">
                <label class="block">
                  <span class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--text-secondary)">
                    <UserRound class="h-4 w-4" />
                    {{ t('authGate.username') }}
                  </span>
                  <input
                    v-model="username"
                    type="text"
                    autocomplete="username"
                    :placeholder="t('authGate.usernamePlaceholder')"
                    class="min-h-13 w-full rounded-3xl bg-(--surface-muted) px-4 py-3.5 text-base font-medium text-(--text-primary) placeholder:text-(--text-secondary)/70 smooth-shadow hover:-translate-y-0.5 hover:shadow-md"
                  />
                </label>

                <label class="block">
                  <span class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--text-secondary)">
                    <KeyRound class="h-4 w-4" />
                    {{ t('authGate.password') }}
                  </span>
                  <input
                    v-model="password"
                    type="password"
                    autocomplete="current-password"
                    :placeholder="t('authGate.passwordPlaceholder')"
                    class="min-h-13 w-full rounded-3xl bg-(--surface-muted) px-4 py-3.5 text-base font-medium text-(--text-primary) placeholder:text-(--text-secondary)/70 smooth-shadow hover:-translate-y-0.5 hover:shadow-md"
                  />
                </label>

                <label class="block">
                  <span class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--text-secondary)">
                    <Fingerprint class="h-4 w-4" />
                    {{ t('authGate.pin') }}
                  </span>
                  <input
                    v-model="pin"
                    type="password"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    :placeholder="t('authGate.pinPlaceholder')"
                    class="min-h-13 w-full rounded-3xl bg-(--surface-muted) px-4 py-3.5 text-base font-medium text-(--text-primary) placeholder:text-(--text-secondary)/70 smooth-shadow hover:-translate-y-0.5 hover:shadow-md"
                  />
                </label>

                <p v-if="localError || authState.error" class="rounded-3xl bg-red-500/10 px-4 py-3.5 text-sm font-medium text-red-600 dark:text-red-300">
                  {{ localError || authState.error }}
                </p>

                <button
                  type="submit"
                  :disabled="submitting"
                  class="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-(--text-primary) px-4 py-3.5 text-base font-semibold text-(--bg-body) smooth-shadow hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
                  <LockKeyhole v-else class="h-4 w-4" />
                  <span>{{ submitting ? t('authGate.working') : isSetup ? t('authGate.setupAction') : t('authGate.loginAction') }}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>