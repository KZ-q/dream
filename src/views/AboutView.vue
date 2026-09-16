<script setup>
import { computed } from 'vue'
import { useContent } from '../composables/useContent'
import { tUI } from '../utils/ui'
import { resolveSrc } from '../utils/image'
import AppLink from '../components/AppLink.vue'
import SocialIcon from '../components/SocialIcon.vue'
import IconGlyph from '../components/IconGlyph.vue'

/* 关于：个人简介 + 技能条 + 工具链 + 时间线 + 联系方式 */
const { state, t } = useContent()

const about = computed(() => state.content?.about || {})
const socials = computed(() => state.content?.site?.socials || [])
const email = computed(() => state.content?.site?.contactEmail || '')

const infoRows = computed(() => {
  const a = about.value
  return [
    a.location ? { icon: 'pin', text: t(a.location) } : null,
    email.value ? { icon: 'mail', text: email.value } : null,
    a.status ? { icon: 'spark', text: t(a.status) } : null
  ].filter(Boolean)
})
</script>

<template>
  <div class="container">
    <!-- 简介 -->
    <section class="intro">
      <div class="avatar card" v-reveal>
        <img :src="resolveSrc(about.avatar?.src)" :alt="t(about.avatar?.alt)" />
      </div>
      <div class="bio" v-reveal="90">
        <p class="kicker">{{ tUI('about') }}</p>
        <h1 class="display title">{{ t(about.name) }}</h1>
        <p class="role">{{ t(about.role) }}</p>
        <p v-for="(p, i) in about.bio || []" :key="i" class="para">{{ t(p) }}</p>
        <ul class="meta">
          <li v-for="(r, i) in infoRows" :key="i">
            <IconGlyph :name="r.icon" :size="17" />
            <span>{{ r.text }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- 技能 -->
    <section class="block">
      <header class="sec-head" v-reveal>
        <div>
          <p class="kicker">{{ tUI('skills') }}</p>
          <h2 class="display section-title">{{ t(about.skills?.title) }}</h2>
        </div>
      </header>
      <div class="skill-grid">
        <div v-for="(g, gi) in about.skills?.groups || []" :key="gi" class="card skill-group" v-reveal="gi * 80">
          <h3 class="display gname">{{ t(g.name) }}</h3>
          <div v-for="(s, si) in g.items || []" :key="si" class="skill">
            <div class="skill-head">
              <span>{{ t(s.name) }}</span>
              <span class="lv">{{ s.level }}%</span>
            </div>
            <div class="track">
              <i class="fill" :style="{ '--lv': `${s.level}%` }" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 工具链 -->
    <section v-if="(about.tools || []).length" class="block">
      <header class="sec-head" v-reveal>
        <div>
          <p class="kicker">{{ tUI('tools') }}</p>
          <h2 class="display section-title">{{ t(about.toolsTitle) }}</h2>
        </div>
      </header>
      <div class="chips" v-reveal>
        <span v-for="(tool, i) in about.tools" :key="i" class="chip tool">{{ t(tool) }}</span>
      </div>
    </section>

    <!-- 时间线 -->
    <section v-if="(about.timeline || []).length" class="block">
      <header class="sec-head" v-reveal>
        <div>
          <p class="kicker">{{ tUI('timeline') }}</p>
          <h2 class="display section-title">{{ t(about.timelineTitle) }}</h2>
        </div>
      </header>
      <ol class="timeline">
        <li v-for="(e, i) in about.timeline" :key="i" v-reveal="i * 70">
          <span class="node" aria-hidden="true" />
          <p class="year display">{{ e.year }}</p>
          <h3 class="display et">{{ t(e.title) }}</h3>
          <p class="ed">{{ t(e.desc) }}</p>
        </li>
      </ol>
    </section>

    <!-- 联系 -->
    <section id="contact" class="block contact card">
      <div class="c-inner" v-reveal>
        <p class="kicker">{{ tUI('contact') }}</p>
        <h2 class="display section-title grad-anim">{{ t(about.contact?.title) }}</h2>
        <p class="lead">{{ t(about.contact?.desc) }}</p>
        <div class="c-actions">
          <a v-if="email" :href="`mailto:${email}`" class="btn btn-primary">
            <IconGlyph name="mail" :size="18" /> {{ email }}
          </a>
          <AppLink v-if="about.contact?.cta?.url" :to="about.contact.cta.url" class="btn btn-ghost">
            {{ t(about.contact.cta.label) }}
          </AppLink>
        </div>
        <div v-if="socials.length" class="socials">
          <a
            v-for="(s, i) in socials"
            :key="i"
            :href="s.url"
            target="_blank"
            rel="noopener"
            :aria-label="t(s.label)"
            :title="t(s.label)"
          >
            <SocialIcon :name="s.platform" :size="19" />
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.intro {
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 7fr);
  gap: clamp(24px, 4vw, 56px);
  align-items: center;
  padding-top: calc(68px + clamp(48px, 8vw, 96px));
  padding-bottom: clamp(20px, 4vw, 44px);
}
.avatar {
  aspect-ratio: 4 / 5;
  overflow: hidden;
  max-width: 380px;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.title {
  font-size: clamp(34px, 5vw, 60px);
}
.role {
  color: var(--c-accent);
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 8px 0 18px;
}
.para {
  color: var(--c-muted);
  max-width: 60ch;
  margin: 0 0 12px;
}
.meta {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: grid;
  gap: 8px;
}
.meta li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--c-muted);
  font-size: 14px;
}
.meta li :first-child {
  color: var(--c-accent);
}

.block {
  padding-block: clamp(36px, 6vw, 64px) 0;
}

/* 技能条 */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}
.skill-group {
  padding: 26px 26px 22px;
}
.gname {
  font-size: 18px;
  margin-bottom: 18px;
}
.skill {
  margin-bottom: 14px;
}
.skill-head {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 7px;
}
.lv {
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}
.track {
  height: 6px;
  border-radius: 999px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: var(--grad-btn);
  transition: width 1s var(--ease) 150ms;
}
.reveal.is-visible .fill {
  width: var(--lv);
}

/* 工具链 */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 24px;
}
.tool {
  padding: 8px 16px;
  font-size: 13px;
  transition: border-color var(--t-fast) var(--ease), color var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}
.tool:hover {
  border-color: var(--c-primary);
  color: var(--c-text);
  transform: translateY(-2px);
}

/* 时间线 */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0 0 8px;
  position: relative;
  max-width: 760px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: var(--c-line);
}
.timeline li {
  position: relative;
  padding: 0 0 30px 36px;
}
.node {
  position: absolute;
  left: 0;
  top: 7px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid var(--c-primary);
  background: var(--c-bg);
  box-shadow: 0 0 12px color-mix(in srgb, var(--c-primary) 60%, transparent);
}
.year {
  color: var(--c-accent);
  font-size: 14px;
  letter-spacing: 0.14em;
}
.et {
  font-size: 20px;
  margin: 4px 0 6px;
}
.ed {
  color: var(--c-muted);
  margin: 0;
  max-width: 58ch;
}

/* 联系 */
.contact {
  margin-block: clamp(48px, 8vw, 88px) 48px;
  overflow: hidden;
  text-align: center;
}
.c-inner {
  padding: clamp(40px, 6vw, 72px) clamp(20px, 5vw, 64px);
}
.lead {
  max-width: 52ch;
  margin: 14px auto 0;
}
.c-actions {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 30px;
}
.socials {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 30px;
}
.socials a {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  color: var(--c-muted);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}
.socials a:hover {
  color: var(--c-text);
  border-color: var(--c-primary);
  transform: translateY(-3px);
}

@media (max-width: 820px) {
  .intro {
    grid-template-columns: 1fr;
  }
  .avatar {
    max-width: 300px;
  }
}
</style>
