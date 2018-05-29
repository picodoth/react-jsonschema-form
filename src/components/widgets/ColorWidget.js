import React from "react"; import PropTypes from "prop-types";

import BaseInput from "./BaseInput";


function ColorWidget(props) {
  return <BaseInput type="color" {...props}/>;
}

if (process.env.NODE_ENV !== "production") {
  ColorWidget.propTypes = {
    value: PropTypes.string,
  };
}

export default ColorWidget;
