import React from 'react';
import { arrayOf, bool, number, object, oneOf, shape, string } from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import config from '../../config';
import { FormattedMessage, injectIntl, intlShape } from '../../util/reactIntl';
import {
  TX_TRANSITION_ACTOR_CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER,
  getProcess,
} from '../../util/transaction';
import { propTypes, DATE_TYPE_DATE, LINE_ITEM_ITEM, LISTING_UNIT_TYPES } from '../../util/types';
import { formatDateIntoPartials } from '../../util/dates';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { isScrollingDisabled } from '../../ducks/UI.duck';
import {
  Avatar,
  BookingTimeInfo,
  NamedLink,
  NotificationBadge,
  Page,
  PaginationLinks,
  TabNav,
  LayoutSideNavigation,
  LayoutWrapperMain,
  LayoutWrapperSideNav,
  LayoutWrapperTopbar,
  LayoutWrapperFooter,
  Footer,
  IconSpinner,
  UserDisplayName,
} from '../../components';

import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import NotFoundPage from '../../containers/NotFoundPage/NotFoundPage';

import css from './InboxPage.module.css';

const CUSTOMER = TX_TRANSITION_ACTOR_CUSTOMER;
const PROVIDER = TX_TRANSITION_ACTOR_PROVIDER;
const FLEX_PRODUCT_DEFAULT_PROCESS = 'flex-product-default-process';
const FLEX_DAILY_DEFAULT_PROCESS = 'flex-default-process';

// This class helps to resolve correct UI data for each combination of conditional data [state & role]
class ConditionalResolver {
  constructor(data) {
    this.data = data;
    this.resolver = null;
    this.defaultResolver = null;
  }
  cond(conditions, resolver) {
    if (this.resolver == null) {
      const isWildcard = item => typeof item === 'undefined';
      const isMatch = conditions.reduce(
        (isPartialMatch, item, i) => isPartialMatch && (isWildcard(item) || item === this.data[i]),
        true
      );
      this.resolver = isMatch ? resolver : null;
    }
    return this;
  }
  default(defaultResolver) {
    this.defaultResolver = defaultResolver;
    return this;
  }
  resolve() {
    return this.resolver ? this.resolver() : this.defaultResolver ? this.defaultResolver() : {};
  }
}

// Get UI data mapped to specific transaction state & role
export const getStateDataForProductProcess = params => {
  const { transaction, transactionRole } = params;

  const processName = FLEX_PRODUCT_DEFAULT_PROCESS;
  const process = getProcess(processName);
  const { getState, states } = process;
  const processState = getState(transaction);

  // Undefined underscore works as a wildcard
  let _;
  return new ConditionalResolver([processState, transactionRole])
    .cond([states.ENQUIRY, _], () => {
      return { processName, processState, actionNeeded: true, emphasizeTransitionMoment: true };
    })
    .cond([states.PENDING_PAYMENT, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.PENDING_PAYMENT, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.CANCELED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.PURCHASED, PROVIDER], () => {
      return { processName, processState, actionNeeded: true, isSaleNotification: true };
    })
    .cond([states.DELIVERED, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.DISPUTED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.COMPLETED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .default(() => {
      // Default values for other states
      return { processName, processState };
    })
    .resolve();
};

// Get UI data mapped to specific transaction state & role
export const getStateDataForDailyProcess = params => {
  const { transaction, transactionRole } = params;

  const processName = FLEX_DAILY_DEFAULT_PROCESS;
  const process = getProcess(processName);
  const { getState, states } = process;
  const processState = getState(transaction);

  // Undefined underscore works as a wildcard
  let _;
  return new ConditionalResolver([processState, transactionRole])
    .cond([states.ENQUIRY, _], () => {
      return { processName, processState, actionNeeded: true, emphasizeTransitionMoment: true };
    })
    .cond([states.PENDING_PAYMENT, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.CANCELED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.PREAUTHORIZED, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.ACCEPTED, _], () => {
      return { processName, processState, actionNeeded: true, emphasizeTransitionMoment: true };
    })
    .cond([states.DECLINED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.DELIVERED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .default(() => {
      // Default values for other states
      return { processName, processState };
    })
    .resolve();
};

// Translated name of the state of the given transaction
export const getStateData = params => {
  const { transaction } = params;
  const processName = transaction?.attributes?.processName;

  if (processName === FLEX_PRODUCT_DEFAULT_PROCESS) {
    return getStateDataForProductProcess(params);
  } else if (processName === FLEX_DAILY_DEFAULT_PROCESS) {
    return getStateDataForDailyProcess(params);
  } else {
    return {};
  }
};

export const InboxItem = props => {
  const { transactionRole, tx, intl, stateData } = props;
  const { customer, provider, listing } = tx;
  const {
    processName,
    processState,
    actionNeeded,
    emphasizeTransitionMoment,
    isSaleNotification,
    isFinal,
  } = stateData;
  const isCustomer = transactionRole === TX_TRANSITION_ACTOR_CUSTOMER;

  const unitLineItem = tx.attributes?.lineItems?.find(
    item => LISTING_UNIT_TYPES.includes(item.code) && !item.reversal
  );
  const isProductOrder = unitLineItem?.code === LINE_ITEM_ITEM;
  const quantity = isProductOrder ? unitLineItem.quantity.toString() : null;

  const otherUser = isCustomer ? provider : customer;
  const otherUserDisplayName = <UserDisplayName user={otherUser} intl={intl} />;
  const isOtherUserBanned = otherUser.attributes.banned;

  const rowNotificationDot = isSaleNotification ? <div className={css.notificationDot} /> : null;
  const lastTransitionedAt = formatDateIntoPartials(tx.attributes.lastTransitionedAt, intl);

  const linkClasses = classNames(css.itemLink, {
    [css.bannedUserLink]: isOtherUserBanned,
  });
  const stateClasses = classNames(css.stateName, {
    [css.stateConcluded]: isFinal,
    [css.stateActionNeeded]: actionNeeded,
    [css.stateNoActionNeeded]: !actionNeeded,
  });
  const lastTransitionedAtClasses = classNames(css.lastTransitionedAt, {
    [css.lastTransitionedAtEmphasized]: emphasizeTransitionMoment,
  });

  return (
    <div className={css.item}>
      <div className={css.itemAvatar}>
        <Avatar user={otherUser} />
      </div>
      <NamedLink
        className={linkClasses}
        name={isCustomer ? 'OrderDetailsPage' : 'SaleDetailsPage'}
        params={{ id: tx.id.uuid }}
      >
        <div className={css.rowNotificationDot}>{rowNotificationDot}</div>
        <div className={css.itemInfo}>
          <div className={css.itemUsername}>{otherUserDisplayName}</div>
          <div className={css.itemOrderInfo}>
            <span>{listing?.attributes?.title}</span>
            <br />
            {isProductOrder ? (
              <FormattedMessage id="InboxPage.quantity" values={{ quantity }} />
            ) : tx?.booking ? (
              <BookingTimeInfo
                isOrder={isCustomer}
                intl={intl}
                booking={tx.booking}
                lineItemUnitType={unitLineItem?.code}
                dateType={DATE_TYPE_DATE}
              />
            ) : null}
          </div>
        </div>
        <div className={css.itemState}>
          <div className={stateClasses}>
            <FormattedMessage
              id={`InboxPage.${processName}.${transactionRole}.${processState}.status`}
            />
          </div>
          <div className={lastTransitionedAtClasses} title={lastTransitionedAt.dateAndTime}>
            {lastTransitionedAt.date}
          </div>
        </div>
      </NamedLink>
    </div>
  );
};

InboxItem.propTypes = {
  transactionRole: oneOf([TX_TRANSITION_ACTOR_CUSTOMER, TX_TRANSITION_ACTOR_PROVIDER]).isRequired,
  tx: propTypes.transaction.isRequired,
  intl: intlShape.isRequired,
  stateData: object.isRequired,
};

export const InboxPageComponent = props => {
  const {
    currentUser,
    fetchInProgress,
    fetchOrdersOrSalesError,
    intl,
    pagination,
    params,
    providerNotificationCount,
    scrollingDisabled,
    transactions,
  } = props;
  const { tab } = params;
  const validTab = tab === 'orders' || tab === 'sales';
  if (!validTab) {
    return <NotFoundPage />;
  }

  const isOrders = tab === 'orders';
  const hasNoResults = !fetchInProgress && transactions.length === 0 && !fetchOrdersOrSalesError;
  const ordersTitle = intl.formatMessage({ id: 'InboxPage.ordersTitle' });
  const salesTitle = intl.formatMessage({ id: 'InboxPage.salesTitle' });
  const title = isOrders ? ordersTitle : salesTitle;

  const toTxItem = tx => {
    const transactionRole = isOrders ? TX_TRANSITION_ACTOR_CUSTOMER : TX_TRANSITION_ACTOR_PROVIDER;
    const stateData = getStateData({ transaction: tx, transactionRole, intl });

    // Render InboxItem only if the latest transition of the transaction is handled in the `txState` function.
    return stateData ? (
      <li key={tx.id.uuid} className={css.listItem}>
        <InboxItem transactionRole={transactionRole} tx={tx} intl={intl} stateData={stateData} />
      </li>
    ) : null;
  };

  const hasOrderOrSaleTransactions = (tx, isOrdersTab, user) => {
    return isOrdersTab
      ? user?.id && tx && tx.length > 0 && tx[0].customer.id.uuid === user?.id?.uuid
      : user?.id && tx && tx.length > 0 && tx[0].provider.id.uuid === user?.id?.uuid;
  };
  const hasTransactions =
    !fetchInProgress && hasOrderOrSaleTransactions(transactions, isOrders, currentUser);

  const tabs = [
    {
      text: (
        <span>
          <FormattedMessage id="InboxPage.ordersTabTitle" />
        </span>
      ),
      selected: isOrders,
      linkProps: {
        name: 'InboxPage',
        params: { tab: 'orders' },
      },
    },
    {
      text: (
        <span>
          <FormattedMessage id="InboxPage.salesTabTitle" />
          {providerNotificationCount > 0 ? (
            <NotificationBadge count={providerNotificationCount} />
          ) : null}
        </span>
      ),
      selected: !isOrders,
      linkProps: {
        name: 'InboxPage',
        params: { tab: 'sales' },
      },
    },
  ];

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation>
        <LayoutWrapperTopbar>
          <TopbarContainer
            className={css.topbar}
            mobileRootClassName={css.mobileTopbar}
            desktopClassName={css.desktopTopbar}
            currentPage="InboxPage"
          />
        </LayoutWrapperTopbar>
        <LayoutWrapperSideNav className={css.navigation}>
          <h1 className={css.title}>
            <FormattedMessage id="InboxPage.title" />
          </h1>
          <TabNav rootClassName={css.tabs} tabRootClassName={css.tab} tabs={tabs} />
        </LayoutWrapperSideNav>
        <LayoutWrapperMain>
          {fetchOrdersOrSalesError ? (
            <p className={css.error}>
              <FormattedMessage id="InboxPage.fetchFailed" />
            </p>
          ) : null}
          <ul className={css.itemList}>
            {!fetchInProgress ? (
              transactions.map(toTxItem)
            ) : (
              <li className={css.listItemsLoading}>
                <IconSpinner />
              </li>
            )}
            {hasNoResults ? (
              <li key="noResults" className={css.noResults}>
                <FormattedMessage
                  id={isOrders ? 'InboxPage.noOrdersFound' : 'InboxPage.noSalesFound'}
                />
              </li>
            ) : null}
          </ul>
          {hasTransactions && pagination && pagination.totalPages > 1 ? (
            <PaginationLinks
              className={css.pagination}
              pageName="InboxPage"
              pagePathParams={params}
              pagination={pagination}
            />
          ) : null}
        </LayoutWrapperMain>
        <LayoutWrapperFooter>
          <Footer />
        </LayoutWrapperFooter>
      </LayoutSideNavigation>
    </Page>
  );
};

InboxPageComponent.defaultProps = {
  currentUser: null,
  currentUserHasOrders: null,
  fetchOrdersOrSalesError: null,
  pagination: null,
  providerNotificationCount: 0,
  sendVerificationEmailError: null,
};

InboxPageComponent.propTypes = {
  params: shape({
    tab: string.isRequired,
  }).isRequired,

  currentUser: propTypes.currentUser,
  fetchInProgress: bool.isRequired,
  fetchOrdersOrSalesError: propTypes.error,
  pagination: propTypes.pagination,
  providerNotificationCount: number,
  scrollingDisabled: bool.isRequired,
  transactions: arrayOf(propTypes.transaction).isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

const mapStateToProps = state => {
  const { fetchInProgress, fetchOrdersOrSalesError, pagination, transactionRefs } = state.InboxPage;
  const { currentUser, currentUserNotificationCount: providerNotificationCount } = state.user;
  return {
    currentUser,
    fetchInProgress,
    fetchOrdersOrSalesError,
    pagination,
    providerNotificationCount,
    scrollingDisabled: isScrollingDisabled(state),
    transactions: getMarketplaceEntities(state, transactionRefs),
  };
};

const InboxPage = compose(
  connect(mapStateToProps),
  injectIntl
)(InboxPageComponent);

export default InboxPage;
