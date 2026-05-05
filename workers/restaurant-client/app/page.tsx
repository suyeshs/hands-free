'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useMenu } from './contexts/MenuContext';
import { useTheme } from './contexts/ThemeContext';
import RestaurantOrderingApp from './components/RestaurantOrderingApp';

const Home = observer(function Home() {
    const { items: menuItems } = useMenu();
    const { theme } = useTheme();

    // Detect if we should use the Grab Food theme layout
    const isGrabFoodTheme = theme?.meta?.name === 'KHAO PIYO' ||
        theme?.meta?.id === 'khao-piyo-custom' ||
        theme?.config?.layout === 'grab-food';

    return (
        <div className="min-h-screen">
            <RestaurantOrderingApp
                isGrabFoodTheme={isGrabFoodTheme}
                themeConfig={theme?.config}
                menuItems={menuItems}
            />
        </div>
    );
});

export default Home;
