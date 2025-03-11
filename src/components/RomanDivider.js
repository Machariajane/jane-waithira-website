// src/components/RomanDivider.js
import React from 'react';
import styled from 'styled-components';

const DividerContainer = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme, margin }) => margin || `${theme.spacing.xlarge} 0`};
  
  &:before, &:after {
    content: "";
    flex-grow: 1;
    height: 1px;
    background-color: ${({ theme, color }) => color || theme.colors.secondary};
    opacity: ${({ opacity }) => opacity || 0.5};
  }
  
  span {
    padding: 0 ${({ theme }) => theme.spacing.medium};
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme, color }) => color || theme.colors.secondary};
    font-size: ${({ fontSize }) => fontSize || '1.5rem'};
  }
`;

function RomanDivider({
                          symbol = "⚜",
                          color,
                          opacity,
                          margin,
                          fontSize,
                          className
                      }) {
    return (
        <DividerContainer
            color={color}
            opacity={opacity}
            margin={margin}
            fontSize={fontSize}
            className={className}
        >
            <span>{symbol}</span>
        </DividerContainer>
    );
}

export default RomanDivider;