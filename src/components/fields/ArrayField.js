import React, {Component} from "react";
import PropTypes from "prop-types";
import {validate as jsonValidate} from "jsonschema";

import {
  getWidget,
  getDefaultFormState,
  getUiOptions,
  isMultiSelect,
  isFilesArray,
  isFixedItems,
  allowAdditionalItems,
  optionsList,
  retrieveSchema,
  toIdSchema,
  shouldRender,
  getDefaultRegistry,
  setState
} from "../../utils";

function ArrayFieldTitle({TitleField, idSchema, title, required}) {
  if (!title) {
    // See #312: Ensure compatibility with old versions of React.
    return <div/>;
  }
  const id = `${idSchema.$id}__title`;
  return <TitleField id={id} title={title} required={required}/>;
}

function ArrayFieldDescription({DescriptionField, idSchema, description}) {
  if (!description) {
    // See #312: Ensure compatibility with old versions of React.
    return <div/>;
  }
  const id = `${idSchema.$id}__description`;
  return <DescriptionField id={id} description={description}/>;
}

function IconBtn(props) {
  const {type="default", icon, className, ...otherProps} = props;
  return (
    <button type="button" className={`btn btn-${type} ${className}`} {...otherProps}>
      <i className={`glyphicon glyphicon-${icon}`}/>
    </button>
  );
}

// Used in the two templates
function DefaultArrayItem(props) {
  const btnStyle = {flex: 1, paddingLeft: 6, paddingRight: 6, fontWeight: "bold"};
  return (
    <div key={props.index} className={props.className}>

      <div className={props.hasToolbar ? "col-xs-9" : "col-xs-12"}>
        {props.selectWidget}
        {props.children}
      </div>

      {props.hasToolbar ?
        <div className="col-xs-3 array-item-toolbox">
          <div className="btn-group" style={{display: "flex", justifyContent: "space-around"}}>

            {props.hasMoveUp || props.hasMoveDown ?
              <IconBtn icon="arrow-up" className="array-item-move-up"
                tabIndex="-1"
                style={btnStyle}
                disabled={props.disabled || props.readonly || !props.hasMoveUp}
                onClick={props.onReorderClick(props.index, props.index - 1)}/>
            : null}

            {props.hasMoveUp || props.hasMoveDown ?
              <IconBtn icon="arrow-down" className="array-item-move-down"
                tabIndex="-1"
                style={btnStyle}
                disabled={props.disabled || props.readonly || !props.hasMoveDown}
                onClick={props.onReorderClick(props.index, props.index + 1)}/>
            : null}

            {props.hasRemove ?
              <IconBtn type="danger" icon="remove" className="array-item-remove"
                tabIndex="-1"
                style={btnStyle}
                disabled={props.disabled || props.readonly}
                onClick={props.onDropIndexClick(props.index)}/>
            : null}
          </div>
        </div>
      : null}

    </div>
  );
}

function DefaultFixedArrayFieldTemplate(props) {
  return (
    <fieldset className={props.className}>

      <ArrayFieldTitle
          key={`array-field-title-${props.idSchema.$id}`}
          TitleField={props.TitleField}
          idSchema={props.idSchema}
          title={props.title}
          required={props.required}/>

      {props.schema.description ? (
        <div className="field-description" key={`field-description-${props.idSchema.$id}`}>
          {props.schema.description}
        </div>
      ) : null}

      <div className="row array-item-list"
        key={`array-item-list-${props.idSchema.$id}`}>
        {props.items && props.items.map(DefaultArrayItem)}
      </div>

      {props.canAdd ? <AddButton
                        onClick={props.onAddClick}
                        disabled={props.disabled || props.readonly}/> : null}
    </fieldset>
  );
}

function DefaultNormalArrayFieldTemplate(props) {
  return (
    <fieldset className={props.className}>

      <ArrayFieldTitle
        key={`array-field-title-${props.idSchema.$id}`}
        TitleField={props.TitleField}
        idSchema={props.idSchema}
        title={props.title}
        required={props.required}/>

      {props.schema.description ? (
        <ArrayFieldDescription
          key={`array-field-description-${props.idSchema.$id}`}
          DescriptionField={props.DescriptionField}
          idSchema={props.idSchema}
          description={props.schema.description}/>
      ) : null}

      <div className="row array-item-list"
          key={`array-item-list-${props.idSchema.$id}`}>
          {props.items && props.items.map(p => DefaultArrayItem(p))}
      </div>

      {props.canAdd ? <AddButton
                        onClick={props.onAddClick}
                        disabled={props.disabled || props.readonly}/> : null}
    </fieldset>
  );
}

class ArrayField extends Component {
  static defaultProps = {
    uiSchema: {},
    idSchema: {},
    registry: getDefaultRegistry(),
    required: false,
    disabled: false,
    readonly: false,
    autofocus: false,
  };

  constructor(props) {
    super(props);
    const formData = this.getStateFromProps(props);
    let anyOfItems = [];
    if (this.getAnyOfItemsSchema()) {
      // We need to construct the initial anyOfItems state, by searching for the props anyOf items
      // in the available anyOf schema items
      anyOfItems = this.getAnyOfItemsFromProps(formData.items, props.schema.items.anyOf);
    }
    this.state = {formData: formData, anyOfItems: anyOfItems};
  }

  componentWillReceiveProps(nextProps) {
    const newState = Object.assign({}, this.state, {formData: this.getStateFromProps(nextProps)});
    this.setState(newState);
  }

  getStateFromProps(props) {
    const formData = Array.isArray(props.formData) ? props.formData : null;
    const {definitions} = this.props.registry;
    return {
      items: getDefaultFormState(props.schema, formData, definitions) || []
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shouldRender(this, nextProps, nextState);
  }

  getAnyOfItemsFromProps(formDataItems, anyOfSchema) {
    return formDataItems.map((item) => {
      const type = typeof item;
      const itemType = (type === "object" && Array.isArray(item)) ? "array" : type;
      const schema = this.getAnyOfItemSchema(anyOfSchema, itemType, item);

      // If this schema is an array, we need to recursively add its contents
      if (schema.type === "array") {
        this.getAnyOfItemsFromProps(item, schema.items.anyOf);
      }

      return schema;
    });
  }

  getAnyOfItemSchema(anyOfSchema, type, item) {
    return anyOfSchema.find((schemaElement) => {
      if ("$ref" in schemaElement) {
        const refSchema = retrieveSchema(schemaElement, this.props.registry.definitions);
        const {errors} = jsonValidate(item, refSchema);
        return errors.length === 0;
      }
      const schemaElementType = schemaElement.type === "integer" ? "number" : schemaElement.type;
      return schemaElementType === type;
    });
  }

  get itemTitle() {
    const {schema} = this.props;
    return schema.items.title || schema.items.description || "Item";
  }

  isItemRequired(itemsSchema) {
    return itemsSchema.type === "string" && itemsSchema.minLength > 0;
  }

  asyncSetState(state, options={validate: false}) {
    setState(this, state, () => {
      this.props.onChange(this.state.formData.items, options);
    });
  }

  getAnyOfItemsSchema() {
    const {schema} = this.props;
    return schema.items.anyOf;
  }

  onAddClick = (event) => {
    event.preventDefault();
    const {items} = this.state.formData;
    const {schema, registry} = this.props;
    const {definitions} = registry;
    let itemSchema = schema.items;
    const anyOfItems = this.getAnyOfItemsSchema();
    if (isFixedItems(schema) && allowAdditionalItems(schema)) {
      itemSchema = schema.additionalItems;
    }

    let newAnyOfItems = [];
    if (anyOfItems) {
      // We pick the first anyOf item by default
      itemSchema = anyOfItems[0];

      newAnyOfItems = [
        ...this.state.anyOfItems,
        itemSchema
      ];
    }

    const newItems = {
      items: items.concat([
        getDefaultFormState(itemSchema, undefined, definitions)
      ])
    };
    const newState = Object.assign({}, this.state, {formData: newItems, anyOfItems: newAnyOfItems});
    this.asyncSetState(newState);
  };

  onDropIndexClick = (index) => {
    return (event) => {
      if (event) {
        event.preventDefault();
      }
      const {formData: {items}, anyOfItems} = this.state;
      const newItems = {
        items: items.filter((_, i) => i !== index)
      };
      const newAnyOfItems = anyOfItems.filter((_, i) => i !== index);
      const newState = Object.assign({}, this.state,
        {formData: newItems, anyOfItems: newAnyOfItems});
      this.asyncSetState(newState, {validate: true}); // refs #195
    };
  };

  onReorderClick = (index, newIndex) => {
    return (event) => {
      if (event) {
        event.preventDefault();
        event.target.blur();
      }
      const {formData: {items}, anyOfItems} = this.state;

      const reorder = (items, newIndex) =>
        items.map((item, i) => {
          if (i === newIndex) {
            return items[index];
          } else if (i === index) {
            return items[newIndex];
          } else {
            return item;
          }
        });

      const newItems = {
        items: reorder(items, newIndex)
      };
      const newAnyOfItems = reorder(anyOfItems, newIndex);

      const newState = Object.assign({}, this.state,
        {formData: newItems}, {anyOfItems: newAnyOfItems});
      this.asyncSetState(newState, {validate: true});
    };
  };

  onChangeForIndex = (index) => {
    return (value) => {
      const items = {
        items: this.state.formData.items.map((item, i) => {
          return index === i ? value : item;
        })
      };
      const newState = Object.assign({}, this.state, {formData: items});
      this.asyncSetState(newState);
    };
  };

  onSelectChange = (value) => {
    const newState = Object.assign({}, this.state, {formData: {items: value}});
    this.asyncSetState(newState);
  };

  anyOfOptions(anyOfItems) {
    return anyOfItems.map(item => ({value: item.type, label: item.title}));
  }

  setWidgetType(index, value) {
    const {items} = this.state.formData;
    const {registry} = this.props;
    const {definitions} = registry;
    const anyOfItemsSchema = this.getAnyOfItemsSchema();
    const newItems = items.slice();
    const foundItem = anyOfItemsSchema.find((element) => element.type === value || element.title === value);
    newItems[index] = getDefaultFormState(foundItem, undefined, definitions);

    const newAnyOfItems = [...this.state.anyOfItems];
    newAnyOfItems[index] = foundItem;

    const newState = Object.assign({}, this.state,
      {formData: {items: newItems}, anyOfItems: newAnyOfItems});

    this.asyncSetState(newState);
  }

  render() {
    const {schema, uiSchema} = this.props;
    if (isFilesArray(schema, uiSchema)) {
      return this.renderFiles();
    }
    if (isFixedItems(schema)) {
      return this.renderFixedArray();
    }
    if (isMultiSelect(schema)) {
      return this.renderMultiSelect();
    }
    return this.renderNormalArray();
  }

  renderNormalArray() {
    const {
      schema,
      uiSchema,
      errorSchema,
      idSchema,
      name,
      required,
      disabled,
      readonly,
      autofocus,
      registry,
      formContext,
      onBlur
    } = this.props;
    const title = (schema.title === undefined) ? name : schema.title;
    const {formData: {items = []}, anyOfItems} = this.state;
    const {ArrayFieldTemplate, definitions, fields} = registry;
    const {TitleField, DescriptionField} = fields;
    let itemsSchema = retrieveSchema(schema.items, definitions);
    const {addable=true} = getUiOptions(uiSchema);
    const anyOfItemsSchema = this.getAnyOfItemsSchema();

    const arrayProps = {
      canAdd: addable,
      items: items.map((item, index) => {
        const itemErrorSchema = errorSchema ? errorSchema[index] : undefined;
        const itemIdPrefix = idSchema.$id + "_" + index;
        if (anyOfItemsSchema) {
          itemsSchema = anyOfItems[index];
        }
        const itemIdSchema = toIdSchema(itemsSchema, itemIdPrefix, definitions);
        return this.renderArrayFieldItem({
          index,
          canMoveUp: index > 0,
          canMoveDown: index < items.length - 1,
          itemSchema: itemsSchema,
          itemIdSchema,
          itemErrorSchema,
          itemData: items[index],
          itemUiSchema: uiSchema.items,
          autofocus: autofocus && index === 0,
          onBlur,
          anyOfItemsSchema: anyOfItemsSchema,
          selectWidgetValue: anyOfItems.length > 0 ? anyOfItems[index].type : ""
        });
      }),
      className: `field field-array field-array-of-${itemsSchema.type}`,
      DescriptionField,
      disabled,
      idSchema,
      onAddClick: this.onAddClick,
      readonly,
      required,
      schema,
      title,
      TitleField,
      formContext
    };

    // Check if a custom render function was passed in
    const renderFunction = ArrayFieldTemplate || DefaultNormalArrayFieldTemplate;
    return renderFunction(arrayProps);
  }

  renderMultiSelect() {
    const {schema, idSchema, uiSchema, disabled, readonly, autofocus, onBlur} = this.props;
    const {items} = this.state.formData;
    const {widgets, definitions, formContext} = this.props.registry;
    const itemsSchema = retrieveSchema(schema.items, definitions);
    const enumOptions = optionsList(itemsSchema);
    const {widget="select", ...options} = {...getUiOptions(uiSchema), enumOptions};
    const Widget = getWidget(schema, widget, widgets);
    return (
      <Widget
        id={idSchema && idSchema.$id}
        multiple
        onChange={this.onSelectChange}
        onBlur={onBlur}
        options={options}
        schema={schema}
        value={items}
        disabled={disabled}
        readonly={readonly}
        formContext={formContext}
        autofocus={autofocus}/>
    );
  }

  renderFiles() {
    const {schema, uiSchema, idSchema, name, disabled, readonly, autofocus, onBlur} = this.props;
    const title = schema.title || name;
    const {items} = this.state.formData;
    const {widgets, formContext} = this.props.registry;
    const {widget="files", ...options} = getUiOptions(uiSchema);
    const Widget = getWidget(schema, widget, widgets);
    return (
      <Widget
        options={options}
        id={idSchema && idSchema.$id}
        multiple
        onChange={this.onSelectChange}
        onBlur={onBlur}
        schema={schema}
        title={title}
        value={items}
        disabled={disabled}
        readonly={readonly}
        formContext={formContext}
        autofocus={autofocus}/>
    );
  }

  renderFixedArray() {
    const {
      schema,
      uiSchema,
      errorSchema,
      idSchema,
      name,
      required,
      disabled,
      readonly,
      autofocus,
      registry,
      onBlur
    } = this.props;
    const title = schema.title || name;
    let {items} = this.state.formData;
    const {ArrayFieldTemplate, definitions, fields} = registry;
    const {TitleField} = fields;
    const itemSchemas = schema.items.map(item =>
      retrieveSchema(item, definitions));
    const additionalSchema = allowAdditionalItems(schema) ?
      retrieveSchema(schema.additionalItems, definitions) : null;
    const {addable=true} = getUiOptions(uiSchema);
    const canAdd = addable && additionalSchema;

    if (!items || items.length < itemSchemas.length) {
      // to make sure at least all fixed items are generated
      items = items || [];
      items = items.concat(new Array(itemSchemas.length - items.length));
    }

    // These are the props passed into the render function
    const arrayProps = {
      canAdd,
      className: "field field-array field-array-fixed-items",
      disabled,
      idSchema,
      items: items.map((item, index) => {
        const additional = index >= itemSchemas.length;
        const itemSchema = additional ?
          additionalSchema : itemSchemas[index];
        const itemIdPrefix = idSchema.$id + "_" + index;
        const itemIdSchema = toIdSchema(itemSchema, itemIdPrefix, definitions);
        const itemUiSchema = additional ?
          uiSchema.additionalItems || {} :
          Array.isArray(uiSchema.items) ?
            uiSchema.items[index] : uiSchema.items || {};
        const itemErrorSchema = errorSchema ? errorSchema[index] : undefined;

        return this.renderArrayFieldItem({
          index,
          canRemove: additional,
          canMoveUp: index >= itemSchemas.length + 1,
          canMoveDown: additional && index < items.length - 1,
          itemSchema,
          itemData: item,
          itemUiSchema,
          itemIdSchema,
          itemErrorSchema,
          autofocus: autofocus && index === 0,
          onBlur
        });
      }),
      onAddClick: this.onAddClick,
      readonly,
      required,
      schema,
      title,
      TitleField
    };

    // Check if a custom template template was passed in
    const renderFunction = ArrayFieldTemplate || DefaultFixedArrayFieldTemplate;
    return renderFunction(arrayProps);
  }

  renderArrayFieldItem({
    index,
    canRemove=true,
    canMoveUp=true,
    canMoveDown=true,
    itemSchema,
    itemData,
    itemUiSchema,
    itemIdSchema,
    itemErrorSchema,
    autofocus,
    onBlur,
    anyOfItemsSchema,
    selectWidgetValue
  }) {
    const {SchemaField} = this.props.registry.fields;
    const {SelectWidget} = this.props.registry.widgets;
    const {disabled, readonly, uiSchema} = this.props;
    const {orderable, removable} = {
      orderable: true,
      removable: true,
      ...uiSchema["ui:options"]
    };
    const has = {
      moveUp: orderable && canMoveUp,
      moveDown: orderable && canMoveDown,
      remove: removable && canRemove
    };
    has.toolbar = Object.keys(has).some(key => has[key]);

    const selectWidget = anyOfItemsSchema ? (
      <div className="form-group" style={{width: 120}}>
        <SelectWidget
          schema={{type: "integer", default: selectWidgetValue}}
          id="select-widget-id"
          options={{enumOptions: this.anyOfOptions(anyOfItemsSchema)}}
          value={selectWidgetValue}
          onChange={(value) => this.setWidgetType(index, value)}/>
      </div>
    ) : null;
    return {
      children: (
        <SchemaField
          schema={itemSchema}
          uiSchema={itemUiSchema}
          formData={itemData}
          errorSchema={itemErrorSchema}
          idSchema={itemIdSchema}
          required={this.isItemRequired(itemSchema)}
          onChange={this.onChangeForIndex(index)}
          onBlur={onBlur}
          registry={this.props.registry}
          disabled={this.props.disabled}
          readonly={this.props.readonly}
          autofocus={autofocus}/>
      ),
      selectWidget: selectWidget,
      className: "array-item",
      disabled,
      hasToolbar: has.toolbar,
      hasMoveUp: has.moveUp,
      hasMoveDown: has.moveDown,
      hasRemove: has.remove,
      index,
      onDropIndexClick: this.onDropIndexClick,
      onReorderClick: this.onReorderClick,
      readonly,
      anyOfItemsSchema,
      selectWidgetValue
    };
  }
}

function AddButton({onClick, disabled}) {
  return (
    <div className="row">
      <p className="col-xs-3 col-xs-offset-9 array-item-add text-right">
        <IconBtn type="info" icon="plus" className="btn-add col-xs-12"
                 tabIndex="0" onClick={onClick}
                 disabled={disabled}/>
      </p>
    </div>
  );
}

if (process.env.NODE_ENV !== "production") {
  ArrayField.propTypes = {
    schema: PropTypes.object.isRequired,
    uiSchema: PropTypes.shape({
      "ui:options": PropTypes.shape({
        addable: PropTypes.bool,
        orderable: PropTypes.bool,
        removable: PropTypes.bool
      })
    }),
    idSchema: PropTypes.object,
    errorSchema: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    onBlur: PropTypes.func,
    formData: PropTypes.array,
    required: PropTypes.bool,
    disabled: PropTypes.bool,
    readonly: PropTypes.bool,
    autofocus: PropTypes.bool,
    registry: PropTypes.shape({
      widgets: PropTypes.objectOf(PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.object,
      ])).isRequired,
      fields: PropTypes.objectOf(PropTypes.func).isRequired,
      definitions: PropTypes.object.isRequired,
      formContext: PropTypes.object.isRequired
    }),
  };
}

export default ArrayField;
