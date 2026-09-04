<template>
  <!--
    The document scrolls underneath the fixed bars now, so this full-width
    transparent band would otherwise swallow every click on the content passing
    below it. The controls inside opt back in individually.
  -->
  <div class="pointer-events-none flex w-full justify-center">
    <div class="flex w-[75%] justify-end xs:w-[85%]">
      <slot></slot>
    </div>
  </div>
</template>
