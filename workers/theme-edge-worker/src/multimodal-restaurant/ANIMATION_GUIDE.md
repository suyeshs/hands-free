# Animation Templates Guide

Complete reference for Framer Motion animation variants in the Multimodal Restaurant Theme.

## 📦 Import

```typescript
import { AnimationTemplates, PageTransitions, ElementTransitions, InteractionAnimations } from '@stonepot/multimodal-restaurant-theme';
```

## 🎬 Page Transitions

For navigating between major screens.

### Landing → Browse/Voice

```tsx
<motion.div
  variants={PageTransitions.slideInRight}
  initial="initial"
  animate="animate"
  exit="exit"
>
  <BrowseMenu />
</motion.div>
```

### Cart Modal

```tsx
<motion.div
  variants={PageTransitions.slideUpModal}
  initial="initial"
  animate="animate"
  exit="exit"
>
  <Cart />
</motion.div>
```

### Available Page Transitions

| Variant | Use Case | Effect |
|---------|----------|--------|
| `landingEntry` | Landing page load | Elegant fade + scale |
| `slideInRight` | Forward navigation | Slide from right |
| `slideInLeft` | Back navigation | Slide from left |
| `slideUpModal` | Modal/overlay | Slide up from bottom |
| `crossFade` | Subtle changes | Cross dissolve |
| `voiceModeActivation` | Voice mode | Scale + blur |

## 🧩 Element Transitions

For individual UI components.

### Menu Card

```tsx
<motion.div
  variants={ElementTransitions.menuCardEntry}
  initial="initial"
  animate="animate"
  whileHover="whileHover"
>
  <MenuItemCard />
</motion.div>
```

### Voice Orb

```tsx
<motion.button
  variants={ElementTransitions.voiceOrbEntry}
  initial="initial"
  animate="animate"
  exit="exit"
>
  <VoiceOrb />
</motion.button>
```

### Modal Backdrop

```tsx
<motion.div
  variants={ElementTransitions.backdropFade}
  initial="initial"
  animate="animate"
  exit="exit"
  className="fixed inset-0 bg-black/40"
/>
```

### Available Element Transitions

| Variant | Use Case | Effect |
|---------|----------|--------|
| `menuCardEntry` | Menu cards | Slide up + fade |
| `categoryPillEntry` | Category tabs | Slide + fade |
| `voiceOrbEntry` | Voice assistant | Scale + glow |
| `cartIslandEntry` | Cart indicator | Bounce in |
| `backdropFade` | Modal backdrop | Fade + blur |
| `dishModalEntry` | Dish details | Scale + slide up |
| `badgePop` | Badges/tags | Pop rotation |
| `toastEntry` | Notifications | Slide from top |
| `progressGrow` | Progress bar | Grow rotate |

## 🎯 Interaction Animations

For hover, tap, and focus states.

### Button

```tsx
<motion.button
  variants={InteractionAnimations.buttonPress}
  whileTap="whileTap"
  whileHover="whileHover"
>
  Add to Cart
</motion.button>
```

### Card with Lift

```tsx
<motion.div
  variants={InteractionAnimations.cardLift}
  whileHover="whileHover"
  whileTap="whileTap"
>
  <DishCard />
</motion.div>
```

### Voice Orb Pulse (Continuous)

```tsx
<motion.div
  variants={InteractionAnimations.voiceOrbPulse}
  animate="animate"
>
  <VoiceOrb />
</motion.div>
```

### Voice State Animations

```tsx
// Listening
<motion.div variants={InteractionAnimations.voiceListening} animate="animate">
  <Orb />
</motion.div>

// Thinking
<motion.div variants={InteractionAnimations.voiceThinking} animate="animate">
  <Orb />
</motion.div>

// Speaking
<motion.div variants={InteractionAnimations.voiceSpeaking} animate="animate">
  <Orb />
</motion.div>
```

### Available Interaction Animations

| Variant | Use Case | Effect |
|---------|----------|--------|
| `buttonPress` | Buttons | Scale down on tap |
| `cardLift` | Cards | Lift on hover |
| `voiceOrbPulse` | Idle orb | Continuous pulse |
| `voiceListening` | Active listening | Breathing |
| `voiceThinking` | Processing | Rotation |
| `voiceSpeaking` | AI speaking | Wave animation |
| `addToCartSuccess` | Cart add | Success bounce |
| `focusRing` | Focus state | Ring glow |
| `errorShake` | Error state | Shake |
| `loadingSpinner` | Loading | Rotate |

## 📋 List/Grid Animations

For staggered animations of multiple items.

### Menu Grid

```tsx
<motion.div
  variants={ListAnimations.menuGridContainer}
  initial="initial"
  animate="animate"
>
  {items.map((item) => (
    <motion.div
      key={item.id}
      variants={ListAnimations.menuGridItem}
    >
      <MenuCard item={item} />
    </motion.div>
  ))}
</motion.div>
```

### Category Carousel

```tsx
<motion.div
  variants={ListAnimations.categoryCarouselContainer}
  animate="animate"
>
  {categories.map((category) => (
    <motion.div
      key={category.id}
      variants={ListAnimations.categoryCarouselItem}
    >
      <CategoryPill category={category} />
    </motion.div>
  ))}
</motion.div>
```

### Cart List

```tsx
<AnimatePresence>
  <motion.div
    variants={ListAnimations.cartListContainer}
    animate="animate"
  >
    {cartItems.map((item) => (
      <motion.div
        key={item.id}
        variants={ListAnimations.cartListItem}
        exit="exit"
      >
        <CartItem item={item} />
      </motion.div>
    ))}
  </motion.div>
</AnimatePresence>
```

### Available List Animations

| Variant | Use Case | Effect |
|---------|----------|--------|
| `menuGridContainer` | Menu grid parent | Stagger children (0.08s) |
| `menuGridItem` | Menu grid items | Slide up + fade |
| `categoryCarouselContainer` | Category parent | Stagger children (0.05s) |
| `categoryCarouselItem` | Category items | Slide + fade |
| `cartListContainer` | Cart parent | Stagger children (0.06s) |
| `cartListItem` | Cart items | Slide + fade, collapse on exit |
| `choiceListContainer` | Combo choices parent | Stagger children (0.04s) |
| `choiceListItem` | Combo choices | Slide up + fade |

## 🎤 Voice-Specific Animations

Special animations for voice interaction feedback.

### Voice Mention Highlight

```tsx
<motion.div
  animate={isVoiceMentioned ? VoiceAnimations.voiceMentionHighlight.animate : {}}
  transition={VoiceAnimations.voiceMentionHighlight.transition}
>
  <MenuCard />
</motion.div>
```

### Transcript Entry

```tsx
<AnimatePresence>
  {transcripts.map((transcript) => (
    <motion.div
      key={transcript.id}
      variants={VoiceAnimations.transcriptEntry}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <TranscriptLine text={transcript.text} />
    </motion.div>
  ))}
</AnimatePresence>
```

### Voice Visualizer Bars

```tsx
{audioLevels.map((level, i) => (
  <motion.div
    key={i}
    variants={VoiceAnimations.voiceVisualizerBar}
    animate="animate"
    style={{ scaleY: level }}
  />
))}
```

### Voice Command Feedback

```tsx
// Success
<motion.div
  animate={commandSuccess ? VoiceAnimations.voiceCommandSuccess.animate : {}}
  transition={VoiceAnimations.voiceCommandSuccess.transition}
>
  <CommandFeedback />
</motion.div>

// Error
<motion.div
  animate={commandError ? VoiceAnimations.voiceCommandError.animate : {}}
  transition={VoiceAnimations.voiceCommandError.transition}
>
  <ErrorFeedback />
</motion.div>
```

### Available Voice Animations

| Variant | Use Case | Effect |
|---------|----------|--------|
| `voiceMentionHighlight` | Item mentioned | Pulse + blue glow |
| `transcriptEntry` | New transcript | Slide from left |
| `voiceVisualizerBar` | Audio bars | Scale Y animation |
| `voiceCommandSuccess` | Command success | Green flash + bounce |
| `voiceCommandError` | Command error | Red flash + shake |

## 🛠️ Utility Functions

### Get Animation by Name

```typescript
import { getAnimationVariant } from '@stonepot/multimodal-restaurant-theme';

const animation = getAnimationVariant('page', 'slideInRight');
```

### Combine Multiple Variants

```typescript
import { combineVariants, ElementTransitions, InteractionAnimations } from '@stonepot/multimodal-restaurant-theme';

const combined = combineVariants(
  ElementTransitions.menuCardEntry,
  InteractionAnimations.cardLift
);
```

## 💡 Best Practices

### 1. Always Use AnimatePresence for Exit Animations

```tsx
<AnimatePresence mode="wait">
  {showModal && (
    <motion.div variants={ElementTransitions.dishModalEntry}>
      <Modal />
    </motion.div>
  )}
</AnimatePresence>
```

### 2. Stagger Lists for Better UX

```tsx
<motion.div variants={ListAnimations.menuGridContainer}>
  {items.map((item) => (
    <motion.div variants={ListAnimations.menuGridItem}>
      <Item />
    </motion.div>
  ))}
</motion.div>
```

### 3. Use Conditional Animations for Voice Feedback

```tsx
<motion.div
  animate={
    voiceState === 'listening' ? InteractionAnimations.voiceListening.animate :
    voiceState === 'thinking' ? InteractionAnimations.voiceThinking.animate :
    voiceState === 'speaking' ? InteractionAnimations.voiceSpeaking.animate :
    {}
  }
/>
```

### 4. Reduce Motion for Accessibility

```tsx
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();

<motion.div
  variants={shouldReduceMotion ? {} : PageTransitions.slideInRight}
/>
```

## 🎨 Customization

All animations can be customized:

```typescript
const customVariant = {
  ...ElementTransitions.menuCardEntry,
  animate: {
    ...ElementTransitions.menuCardEntry.animate,
    transition: {
      duration: 0.5, // Custom duration
      delay: 0.2,    // Custom delay
    },
  },
};
```

## 📱 Performance Tips

1. **Use `willChange` for frequently animated properties:**
   ```css
   .animated-element {
     will-change: transform, opacity;
   }
   ```

2. **Prefer `transform` and `opacity` over other properties**
3. **Use `layout` prop sparingly** - it's expensive
4. **Disable animations on low-end devices** - check `useReducedMotion()`
5. **Use `AnimatePresence` with `mode="wait"`** for smoother transitions

## 🔗 Integration with Theme

Animations are automatically included in the theme:

```typescript
const theme = CoorgFoodCompanyTheme;
const animations = theme.designTokens.animations.motion;

// Use directly
<motion.div variants={animations.fadeIn} />
```
