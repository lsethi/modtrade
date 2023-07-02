import React from 'react';
import { bool, func, node, number } from 'prop-types';
import classNames from 'classnames';

import css from './PopupOpenerButton.module.css';
import { useHistory } from 'react-router-dom';
import {parse } from '../../../util/urlHelpers';

const PopupOpenerButton = props => {
  const { isSelected, labelMaxWidth, toggleOpen, children } = props;

  const labelStyles = isSelected ? css.labelSelected : css.label;
  const labelMaxWidthMaybe = labelMaxWidth ? { maxWidth: `${labelMaxWidth}px` } : {};
  const labelMaxWidthStyles = labelMaxWidth ? css.labelEllipsis : null;
  var  dis ='';
  const params = useHistory();
  const parseParam = parse(params.location.search);
  if(children=='Subcategory' && !parseParam.pub_category){
    dis = 'disabled';
  }
  return (
    <button
      disabled={dis}
      className={classNames(labelStyles, labelMaxWidthStyles)}
      style={labelMaxWidthMaybe}
      onClick={() => toggleOpen()}
    >
      {children}
    </button>
  );
};

PopupOpenerButton.defaultProps = {
  isSelected: false,
  labelMaxWidth: null,
};

PopupOpenerButton.propTypes = {
  isSelected: bool,
  toggleOpen: func.isRequired,
  children: node.isRequired,
  labelMaxWidth: number,
};

export default PopupOpenerButton;
