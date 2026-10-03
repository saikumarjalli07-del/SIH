import React from 'react';

export const Box = ({
  children,
  as: Component = 'div',
  style = {},
  className = '',
  ...props
}) => {
  return (
    <Component
      data-ag-box="true"
      style={style}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
};

export const Stack = ({
  children,
  direction = 'column',
  gap = '0px',
  align = 'stretch',
  justify = 'flex-start',
  style = {},
  className = '',
  ...props
}) => {
  return (
    <div
      data-ag-stack="true"
      style={{
        display: 'flex',
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

export const Grid = ({
  children,
  columns = '1fr',
  gap = '0px',
  style = {},
  className = '',
  ...props
}) => {
  return (
    <div
      data-ag-grid="true"
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap,
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

export const Text = ({
  children,
  as: Component = 'span',
  variant = 'body', // 'heading' | 'body' | 'label' | 'mono'
  color = 'var(--text)',
  size,
  weight,
  style = {},
  className = '',
  ...props
}) => {
  let defaultFont = 'var(--font-body)';
  let defaultSize = '14px';
  let defaultWeight = 400;

  if (variant === 'heading') {
    defaultFont = 'var(--font-heading)';
    defaultSize = '28px';
    defaultWeight = 700;
  } else if (variant === 'label') {
    defaultFont = 'var(--font-body)';
    defaultSize = '11px';
    defaultWeight = 400;
  } else if (variant === 'mono') {
    defaultFont = 'var(--font-mono)';
    defaultSize = '14px';
    defaultWeight = 400;
  }

  return (
    <Component
      data-ag-text="true"
      style={{
        fontFamily: defaultFont,
        fontSize: size || defaultSize,
        fontWeight: weight || defaultWeight,
        color,
        letterSpacing: variant === 'heading' ? '-0.02em' : 'normal',
        lineHeight: 1.3,
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
};
