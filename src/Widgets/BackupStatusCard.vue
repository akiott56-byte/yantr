<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Cloud, HardDrive, ArrowRight, Settings } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const apiUrl = ref('')
const configured = ref(false)
const loading = ref(true)
const config = ref(null)

const status = computed(() => {
  if (loading.value) return { type: 'loading', text: t('quickMetrics.backupStatus.checking'), color: 'slate' }
  if (configured.value) return { type: 'configured', text: t('quickMetrics.backupStatus.active'), color: 'green' }
  return { type: 'not-configured', text: t('quickMetrics.backupStatus.setupRequired'), color: 'yellow' }
})

const isConfigured = computed(() => status.value.type === 'configured')

async function checkConfig() {
  loading.value = true
  try {
    const response = await fetch(`${apiUrl.value}/api/backup/config`)
    const data = await response.json()

    if (data.success) {
      configured.value = data.configured
      if (data.configured) {
        config.value = data.config
      }
    }
  } catch (error) {
    console.error('Failed to check backup config:', error)
  } finally {
    loading.value = false
  }
}

function goToConfig() {
  router.push('/backup-config')
}

onMounted(() => {
  apiUrl.value = window.VITE_API_URL || ''
  checkConfig()
})
</script>

<template>
  <div
    @click="goToConfig"
    class="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] bg-white dark:bg-[#0A0A0A] smooth-shadow cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:smooth-shadow-lg"
  >
    <div class="absolute right-5 top-5 h-16 w-16 rounded-full transition-all duration-500 group-hover:scale-125"
         :class="isConfigured ? 'bg-blue-500/6 blur-2xl group-hover:bg-blue-500/10' : 'bg-amber-500/6 blur-2xl group-hover:bg-amber-500/10'"></div>

    <div class="relative z-10 flex h-full flex-col p-5">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-105 group-hover:-rotate-6"
               :class="isConfigured ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500'">
            <Cloud class="h-4 w-4" />
          </div>
          <div class="min-w-0">
            <h3 class="text-sm font-semibold tracking-tight text-(--text-primary) group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {{ t('quickMetrics.backupStatus.title') }}
            </h3>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="h-1.5 w-1.5 rounded-full shrink-0"
                    :class="loading ? 'bg-gray-400 animate-pulse' : isConfigured ? 'bg-green-500' : 'bg-amber-500 animate-pulse'"></span>
              <span class="text-[10px] font-bold uppercase tracking-wider"
                    :class="isConfigured ? 'text-(--text-secondary)' : 'text-amber-600 dark:text-amber-500'">
                {{ status.text }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-zinc-900 text-gray-400 group-hover:text-blue-500 transition-colors">
          <Settings class="h-3.5 w-3.5" />
        </div>
      </div>

      <!-- Body -->
      <div class="mt-4 flex-1 flex flex-col">
        <!-- Loading -->
        <div v-if="loading" class="space-y-2">
          <div class="h-2.5 w-3/4 rounded bg-gray-100 dark:bg-zinc-800 animate-pulse"></div>
          <div class="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-zinc-800 animate-pulse"></div>
        </div>

        <!-- Configured -->
        <div v-else-if="isConfigured && config" class="space-y-1.5">
          <div class="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-zinc-900/70 px-3 py-2.5">
            <HardDrive class="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <div class="min-w-0 flex-1">
              <p class="text-[9px] font-bold uppercase tracking-[0.15em] text-(--text-secondary) leading-none">Provider</p>
              <p class="mt-0.5 truncate text-xs font-semibold text-(--text-primary)">{{ config.provider }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-zinc-900/70 px-3 py-2.5">
            <Cloud class="h-3.5 w-3.5 shrink-0 text-blue-500" />
            <div class="min-w-0 flex-1">
              <p class="text-[9px] font-bold uppercase tracking-[0.15em] text-(--text-secondary) leading-none">Bucket</p>
              <p class="mt-0.5 truncate text-xs font-mono text-(--text-primary)">{{ config.bucket }}</p>
            </div>
          </div>
        </div>

        <!-- Not configured -->
        <div v-else class="space-y-3">
          <p class="text-sm text-(--text-secondary) leading-relaxed">
            {{ t('quickMetrics.backupStatus.description') }}
          </p>
          <div class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            {{ t('quickMetrics.backupStatus.recommended') }}
          </div>
        </div>
      </div>

      <!-- Footer CTA -->
      <div class="mt-auto pt-4 flex items-center justify-between text-[11px] text-(--text-secondary)">
        <span class="font-medium">{{ t('quickMetrics.backupStatus.configuration') }}</span>
        <span class="flex items-center gap-1 font-semibold opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
              :class="isConfigured ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-500'">
          {{ t('quickMetrics.backupStatus.manage') }}
          <ArrowRight class="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
        </span>
      </div>
    </div>
  </div>
</template>
