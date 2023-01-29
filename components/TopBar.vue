<!-- FIXME: This is working but we want to make these elements separate so that -->
<!-- the bar inbetween will not stop scroll events when hovering over. -->
<template>
  <Bar class="fixed top-16">
    <h1 class="mr-6 h-full">
      <a href="#" class="cursor-pointer">
        <WaveText text="Tino Kaartovuori" />
      </a>
    </h1>
    <div class="flex w-full justify-end">
      <div class="mr-6">
        <a href="#">
          <WaveText text="About" />
        </a>
      </div>
      <div>
        <ModeSwitch />
      </div>
    </div>
  </Bar>
</template>
