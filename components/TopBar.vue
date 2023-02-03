<!-- FIXME: This is working but we want to make these elements separate so that -->
<!-- the bar inbetween will not stop scroll events when hovering over. -->
<template>
  <Bar class="fixed top-16">
    <h1 class="xs:mr-2 flex h-full justify-center align-middle sm:mr-4 md:mr-6">
      <a href="#" class="flex items-center justify-center">
        <WaveText
          text="Tino Kaartovuori"
          class="xs:text-base text-onyx text-sm font-light dark:text-white sm:text-xl md:text-2xl"
          onHover
        />
      </a>
    </h1>
    <div class="flex w-full justify-end">
      <div class="xs:mr-2 flex sm:mr-4 md:mr-6">
        <a href="#" class="flex items-center justify-center">
          <WaveText
            text="About"
            class="xs:text-base text-onyx text-sm font-light dark:text-white sm:text-xl md:text-2xl"
            onHover
          />
        </a>
      </div>
      <div>
        <ThemeSwitch
          class="xs:scale-[0.6] scale-[0.5] sm:scale-[0.7] md:scale-[0.8] lg:scale-100"
        />
      </div>
    </div>
  </Bar>
</template>
