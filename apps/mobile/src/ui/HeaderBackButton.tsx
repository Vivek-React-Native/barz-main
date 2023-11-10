import { useNavigation } from '@react-navigation/native';
import { ArrowLeft as IconArrowLeft, ChevronLeft as IconChevronLeft } from './icons';
import HeaderButton, { HeaderButtonProps } from './HeaderButton';

export default (
  props: Omit<HeaderButtonProps, 'leading'> & {
    appearance?: 'arrow' | 'chevron';
  },
) => {
  const navigation = useNavigation();
  const LeadingIcon = props.appearance === 'chevron' ? IconChevronLeft : IconArrowLeft;
  return navigation.canGoBack() ? (
    <HeaderButton
      leading={(color) => <LeadingIcon color={color} />}
      // NOTE: On android, the top bar text is left aligned, so add some spacing
      trailingSpace
      onPress={navigation.goBack}
      {...props}
    />
  ) : null;
};
